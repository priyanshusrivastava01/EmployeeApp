import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export const PROFILE_PHOTO_STORAGE_KEY = '@ems_profile_photo';
const PROFILE_PHOTOS_DIR_NAME = 'employee_profile_photos';

/**
 * Get storage directory for employee profile photos
 */
export const getProfilePhotosDirectory = () => {
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  return `${baseDir}${PROFILE_PHOTOS_DIR_NAME}/`;
};

/**
 * Ensure profile photo directory exists
 */
export const ensureProfilePhotoDirectoryExists = async () => {
  const dir = getProfilePhotosDirectory();
  try {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (err) {
    console.warn('Profile photo directory check error:', err);
  }
  return dir;
};

/**
 * Retrieve saved profile photo record from local storage
 * Note: Completely distinct from biometric 3-angle face enrollment photos.
 */
export const getProfilePhoto = async () => {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_PHOTO_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    if (!data || !data.uri) {
      return null;
    }

    // Check if the file still exists on disk
    const fileInfo = await FileSystem.getInfoAsync(data.uri);
    if (!fileInfo.exists) {
      return null;
    }

    return {
      uri: data.uri,
      updatedAt: data.updatedAt,
      source: data.source || 'gallery'
    };
  } catch (err) {
    console.warn('Error reading profile photo:', err);
    return null;
  }
};

/**
 * Save selected image URI to permanent local storage
 */
export const saveProfilePhoto = async (tempUri, source = 'gallery') => {
  if (!tempUri) {
    throw new Error('No photo URI provided.');
  }

  const targetDir = await ensureProfilePhotoDirectoryExists();
  const timestamp = Date.now();
  const destUri = `${targetDir}profile_avatar_${timestamp}.jpg`;

  // Clean up any previously saved profile avatar file
  try {
    const prev = await getProfilePhoto();
    if (prev && prev.uri) {
      await FileSystem.deleteAsync(prev.uri, { idempotent: true });
    }
  } catch (cleanErr) {
    // Non-fatal cleanup notice
  }

  // Copy temp picked photo to permanent document directory
  await FileSystem.copyAsync({ from: tempUri, to: destUri });

  const record = {
    uri: destUri,
    updatedAt: new Date().toISOString(),
    source
  };

  await AsyncStorage.setItem(PROFILE_PHOTO_STORAGE_KEY, JSON.stringify(record));
  return record;
};

/**
 * Remove saved profile photo
 */
export const removeProfilePhoto = async () => {
  try {
    const current = await getProfilePhoto();
    if (current && current.uri) {
      await FileSystem.deleteAsync(current.uri, { idempotent: true });
    }
    await AsyncStorage.removeItem(PROFILE_PHOTO_STORAGE_KEY);
    return { success: true };
  } catch (err) {
    console.warn('Error removing profile photo:', err);
    throw err;
  }
};

/**
 * Pick image from device gallery
 */
export const pickProfilePhotoFromLibrary = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Gallery permission is required to select a profile photo.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
};

/**
 * Capture photo using device camera
 */
export const takeProfilePhotoWithCamera = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera permission is required to capture a profile photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    cameraType: ImagePicker.CameraType?.front || 'front'
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
};
