/**
 * fileValidation.js — File validation utilities for document uploads.
 * Provides size, type, and dimension validation for document images.
 */

// Magic bytes signatures for JPEG, PNG, PDF
const FILE_SIGNATURES = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
};

const ALLOWED_TYPES = {
  jpeg: ['image/jpeg', 'image/jpg'],
  png: ['image/png'],
  pdf: ['application/pdf'],
};

/**
 * Detect file type from magic bytes or MIME type.
 * Returns: 'jpeg' | 'png' | 'pdf' | null
 */
export function detectFileType(base64, ext) {
  // If we have consistent extension, trust it first
  if (ext === 'jpeg' || ext === 'jpg') return 'jpeg';
  if (ext === 'png') return 'png';
  if (ext === 'pdf') return 'pdf';

  // Fallback: analyze magic bytes
  try {
    const byteChars = atob(base64);
    const bytes = [];
    for (let i = 0; i < Math.min(byteChars.length, 10); i++) {
      bytes.push(byteChars.charCodeAt(i));
    }

    // Check JPEG (0xFF D8 FF)
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'jpeg';
    }
    // Check PNG (0x89 50 4E 47)
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'png';
    }
    // Check PDF (0x25 50 44 46 = %PDF)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return 'pdf';
    }
  } catch (e) {
    // If base64 parsing fails, return null
  }

  return null;
}

/**
 * Validate base64-encoded file.
 * Returns: { valid: true } or { valid: false, error: string }
 */
export function validateFile(base64, fileName, ext, constraints = {}) {
  const {
    maxSizeMB = 10,
    allowedTypes = ['jpeg', 'png', 'pdf'],
    requireDimensionsForImages = true,
  } = constraints;

  // 1. Check if base64 is provided
  if (!base64) {
    return { valid: false, error: 'No file selected' };
  }

  // 2. Estimate file size from base64
  const estimatedSizeBytes = (base64.length * 3) / 4;
  const estimatedSizeMB = estimatedSizeBytes / (1024 * 1024);
  if (estimatedSizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File is too large (${estimatedSizeMB.toFixed(1)}MB). Maximum is ${maxSizeMB}MB.`,
    };
  }

  // 3. Detect file type
  const detectedType = detectFileType(base64, ext);
  if (!detectedType) {
    return { valid: false, error: 'Unable to detect file type. Please check the file.' };
  }

  // 4. Check if type is allowed
  if (!allowedTypes.includes(detectedType)) {
    const typeStr = allowedTypes.join(', ').toUpperCase();
    return { valid: false, error: `File type not allowed. Supported: ${typeStr}` };
  }

  // 5. For images, optionally check dimensions
  if (requireDimensionsForImages && (detectedType === 'jpeg' || detectedType === 'png')) {
    const dimError = validateImageDimensions(base64, detectedType);
    if (dimError) {
      return { valid: false, error: dimError };
    }
  }

  return { valid: true, detectedType };
}

/**
 * Validate image dimensions — ensure image is not corrupted or too small.
 * Returns: error string if invalid, null if valid
 */
export function validateImageDimensions(base64, fileType) {
  try {
    const byteChars = atob(base64);
    const bytes = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      bytes[i] = byteChars.charCodeAt(i);
    }

    // For JPEG: look for SOF (Start of Frame) marker
    if (fileType === 'jpeg') {
      for (let i = 0; i < bytes.length - 8; i++) {
        // SOF markers: FFD8 (offset 0), FFC0-FFC3, FFC5-FFC7, FFC9-FFCB, FFCD-FFCF
        if (
          bytes[i] === 0xff &&
          (bytes[i + 1] === 0xc0 || bytes[i + 1] === 0xc1 || bytes[i + 1] === 0xc2 || bytes[i + 1] === 0xc3)
        ) {
          // Dimensions are at offset +5 (2 bytes height, 2 bytes width)
          const height = (bytes[i + 5] << 8) | bytes[i + 6];
          const width = (bytes[i + 7] << 8) | bytes[i + 8];
          if (width < 100 || height < 100) {
            return 'Image is too small. Please use a higher resolution photo.';
          }
          return null; // Valid
        }
      }
    }

    // For PNG: IHDR chunk has dimensions at bytes 16-24
    if (fileType === 'png') {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        // IHDR begins at byte 8
        if (bytes.length >= 24) {
          const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
          const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
          if (width < 100 || height < 100) {
            return 'Image is too small. Please use a higher resolution photo.';
          }
          return null; // Valid
        }
      }
    }

    // PDF: hard to validate visually, skip dimension check
    return null;
  } catch (e) {
    // If parsing fails, log and assume it's okay (could be a valid but unusual file)
    console.warn('[Validation] Image dimension parsing error:', e);
    return null;
  }
}

/**
 * Check if file is corrupted by testing base64 decoding.
 * Returns: error string if corrupted, null if valid
 */
export function validateBase64Integrity(base64) {
  try {
    if (!base64 || typeof base64 !== 'string') {
      return 'Invalid base64 data';
    }

    // Try to decode and check for minimum size
    const decoded = atob(base64);
    if (decoded.length === 0) {
      return 'File appears to be empty';
    }

    // Estimate final size
    const estimatedMB = (base64.length * 3) / 4 / (1024 * 1024);
    if (estimatedMB === 0) {
      return 'File is too small or corrupted';
    }

    return null; // Valid
  } catch (e) {
    console.error('[Validation] Base64 integrity check failed:', e);
    return 'File data is corrupted or invalid. Please try again.';
  }
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get estimated file size from base64 string (in bytes).
 */
export function getBase64SizeBytes(base64) {
  return (base64.length * 3) / 4;
}

/**
 * Check if two files are the same (potential duplicate).
 * Compares first 1MB of base64 to detect duplicates.
 */
export function checkForDuplicate(file1, file2) {
  if (!file1 || !file2 || !file1.base64 || !file2.base64) {
    return false;
  }

  // Compare first 1MB of each file
  const chunk1 = file1.base64.substring(0, 1024 * 1024);
  const chunk2 = file2.base64.substring(0, 1024 * 1024);

  return chunk1 === chunk2;
}
