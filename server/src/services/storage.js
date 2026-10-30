/**
 * Private Supabase Storage Service
 * Handles authenticated uploads and signed temporary URLs for private files:
 *  - attendance-selfies
 *  - profile-photos
 *  - advance-proofs
 * 
 * Strict ₹0 budget: Uses Supabase Free Tier built-in Storage (1GB included free).
 */

const { supabase } = require('../config/supabase');

const BUCKETS = {
  SELFIES: 'attendance-selfies',
  AVATARS: 'profile-photos',
  DOCUMENTS: 'employee-documents'
};

/**
 * Checks if a string is a base64 Data URI
 */
function isBase64DataUri(str) {
  if (typeof str !== 'string') return false;
  return str.startsWith('data:image/') && str.includes(';base64,');
}

/**
 * Parses a base64 Data URI into buffer and mimeType
 */
function parseBase64DataUri(dataUri) {
  const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid base64 data URI format');
  }
  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  return { contentType, buffer };
}

/**
 * Uploads a file to a private Supabase Storage bucket
 * @param {Object} options
 * @param {string} options.bucket - Bucket name
 * @param {string} options.path - Destination path inside bucket
 * @param {Buffer} options.buffer - File buffer
 * @param {string} options.contentType - MIME type
 * @returns {Promise<{ success: boolean, path?: string, error?: string, source: string }>}
 */
async function uploadPrivateFile({ bucket, path, buffer, contentType = 'image/jpeg' }) {
  if (!supabase) {
    // Zero-cost development mode fallback
    return {
      success: true,
      path,
      source: 'memory'
    };
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true
    });

    if (error) {
      console.error(`[Storage Upload Error] Bucket: ${bucket}, Path: ${path}:`, error.message);
      return { success: false, error: error.message, source: 'supabase' };
    }

    return {
      success: true,
      path: data.path,
      source: 'supabase'
    };
  } catch (err) {
    console.error('[Storage Upload Exception]:', err.message);
    return { success: false, error: err.message, source: 'supabase' };
  }
}

/**
 * Generates a time-limited signed URL for authorized access to private files
 * @param {Object} options
 * @param {string} options.bucket - Bucket name
 * @param {string} options.path - Storage path
 * @param {number} options.expiresIn - Lifetime in seconds (default 1 hour)
 * @returns {Promise<{ success: boolean, signedUrl?: string, error?: string }>}
 */
async function getSignedDownloadUrl(optionsOrBucket, maybePath, maybeExpiresIn = 3600) {
  let bucket, path, expiresIn;
  if (typeof optionsOrBucket === 'object' && optionsOrBucket !== null) {
    bucket = optionsOrBucket.bucket;
    path = optionsOrBucket.path;
    expiresIn = optionsOrBucket.expiresIn || 3600;
  } else {
    bucket = optionsOrBucket;
    path = maybePath;
    expiresIn = maybeExpiresIn || 3600;
  }

  if (!path) return { success: false, error: 'File path required' };
  
  if (!supabase) {
    return { success: true, signedUrl: path };
  }

  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) {
      console.error(`[Storage SignedUrl Error] Bucket: ${bucket}, Path: ${path}:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true, signedUrl: data.signedUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  BUCKETS,
  isBase64DataUri,
  parseBase64DataUri,
  uploadPrivateFile,
  getSignedDownloadUrl
};

