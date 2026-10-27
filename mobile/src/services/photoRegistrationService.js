import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PHOTO_REGISTRATION_STORAGE_KEY = '@ems_photo_registration';
const PHOTOS_DIR_NAME = 'employee_registration_photos';

/**
 * Get permanent directory path for employee face photos in app-controlled document storage
 */
export const getPhotosDirectory = () => {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  return `${baseDir}${PHOTOS_DIR_NAME}/`;
};

/**
 * Ensures photo registration folder exists
 */
export const ensureDirectoryExists = async () => {
  const dir = getPhotosDirectory();
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (err) {
    console.warn('Directory check error:', err);
  }
  return dir;
};

/**
 * Load current local photo registration status and verified file references
 */
export const getRegistrationStatus = async () => {
  try {
    const raw = await AsyncStorage.getItem(PHOTO_REGISTRATION_STORAGE_KEY);
    if (!raw) {
      return { isRegistered: false, status: 'Not Registered', photos: null };
    }

    const data = JSON.parse(raw);
    if (!data || !data.isRegistered || !data.photos) {
      return { isRegistered: false, status: 'Not Registered', photos: null };
    }

    // Verify all 3 required files actually exist on disk
    const frontInfo = data.photos.front ? await FileSystem.getInfoAsync(data.photos.front) : { exists: false };
    const leftInfo = data.photos.left ? await FileSystem.getInfoAsync(data.photos.left) : { exists: false };
    const rightInfo = data.photos.right ? await FileSystem.getInfoAsync(data.photos.right) : { exists: false };

    if (!frontInfo.exists || !leftInfo.exists || !rightInfo.exists) {
      return {
        isRegistered: false,
        status: 'Incomplete / Missing Files',
        error: 'One or more required registration photos were not found in local storage.',
        photos: null
      };
    }

    return {
      isRegistered: true,
      status: data.status || 'Registered Locally — Cloud Sync Pending',
      registeredAt: data.registeredAt,
      consentDate: data.consentDate,
      employeeId: data.employeeId || 'EMP-2024-0891',
      photos: {
        front: data.photos.front,
        left: data.photos.left,
        right: data.photos.right
      }
    };
  } catch (err) {
    console.warn('Failed to retrieve registration status:', err);
    return { isRegistered: false, status: 'Error Reading Storage', error: err.message, photos: null };
  }
};

/**
 * Save new 3-angle photo registration locally in permanent app storage
 */
export const saveRegistration = async ({
  frontUri,
  leftUri,
  rightUri,
  employeeId = 'EMP-2024-0891',
  consentDate
}) => {
  if (!frontUri || !leftUri || !rightUri) {
    throw new Error('All 3 reference photos (Front, Left, Right) are required to complete registration.');
  }

  // Ensure destination directory exists
  const targetDir = await ensureDirectoryExists();

  const timestamp = Date.now();
  const frontDest = `${targetDir}face_front_${timestamp}.jpg`;
  const leftDest = `${targetDir}face_left_${timestamp}.jpg`;
  const rightDest = `${targetDir}face_right_${timestamp}.jpg`;

  // Clean up any old registration files first to prevent storage buildup
  try {
    const existing = await getRegistrationStatus();
    if (existing.isRegistered && existing.photos) {
      if (existing.photos.front) await FileSystem.deleteAsync(existing.photos.front, { idempotent: true });
      if (existing.photos.left) await FileSystem.deleteAsync(existing.photos.left, { idempotent: true });
      if (existing.photos.right) await FileSystem.deleteAsync(existing.photos.right, { idempotent: true });
    }
  } catch (cleanErr) {
    console.log('Cleanup notice:', cleanErr);
  }

  // Copy temp camera images into permanent app document directory
  await FileSystem.copyAsync({ from: frontUri, to: frontDest });
  await FileSystem.copyAsync({ from: leftUri, to: leftDest });
  await FileSystem.copyAsync({ from: rightUri, to: rightDest });

  // Validate saved files exist before committing metadata
  const checkFront = await FileSystem.getInfoAsync(frontDest);
  const checkLeft = await FileSystem.getInfoAsync(leftDest);
  const checkRight = await FileSystem.getInfoAsync(rightDest);

  if (!checkFront.exists || !checkLeft.exists || !checkRight.exists) {
    throw new Error('Failed to verify saved photo files in device storage.');
  }

  const record = {
    isRegistered: true,
    status: 'Registered Locally — Cloud Sync Pending',
    registeredAt: new Date().toISOString(),
    consentDate: consentDate || new Date().toISOString(),
    employeeId,
    photos: {
      front: frontDest,
      left: leftDest,
      right: rightDest
    }
  };

  await AsyncStorage.setItem(PHOTO_REGISTRATION_STORAGE_KEY, JSON.stringify(record));
  return record;
};

/**
 * Remove local photo registration and delete files
 */
export const removeRegistration = async () => {
  try {
    const current = await getRegistrationStatus();
    if (current.photos) {
      if (current.photos.front) await FileSystem.deleteAsync(current.photos.front, { idempotent: true });
      if (current.photos.left) await FileSystem.deleteAsync(current.photos.left, { idempotent: true });
      if (current.photos.right) await FileSystem.deleteAsync(current.photos.right, { idempotent: true });
    }
    await AsyncStorage.removeItem(PHOTO_REGISTRATION_STORAGE_KEY);
    return { success: true };
  } catch (err) {
    console.warn('Failed to remove registration:', err);
    throw err;
  }
};
