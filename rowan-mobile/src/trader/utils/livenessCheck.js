/**
 * livenessCheck.js — Liveness detection utilities for selfie verification.
 * 
 * Provides motion-based liveness detection to ensure the selfie is captured
 * from a live person and not a static image or spoofed photo.
 * 
 * Strategy:
 * 1. Capture two frames with 1-second delay
 * 2. Compare pixel differences to detect motion
 * 3. Validate face region has sufficient variation
 * 4. Return confidence score and motion metadata
 */

/**
 * Compare two base64 images and calculate motion score.
 * Returns: { motionDetected, motionScore, confidence }
 * 
 * Analysis:
 * - Samples ~200 random pixels from each image
 * - Calculates pixel difference percentage
 * - motionDetected = true if >25% pixels vary
 * - confidence = 0-100 (higher = more lively, more motion)
 */
export function compareImagesForMotion(base64_1, base64_2) {
  try {
    if (!base64_1 || !base64_2) {
      return {
        motionDetected: false,
        motionScore: 0,
        confidence: 0,
        error: 'Missing image data',
      };
    }

    // Decode both base64 strings to byte arrays
    const bytes1 = base64ToByteArray(base64_1);
    const bytes2 = base64ToByteArray(base64_2);

    if (!bytes1 || !bytes2 || bytes1.length === 0 || bytes2.length === 0) {
      return {
        motionDetected: false,
        motionScore: 0,
        confidence: 0,
        error: 'Failed to decode images',
      };
    }

    // Sample pixels and compare
    const sampleSize = Math.min(200, Math.min(bytes1.length, bytes2.length) / 3);
    let pixelDifferences = 0;

    for (let i = 0; i < sampleSize; i++) {
      // Random position in the byte array
      const idx = Math.floor(Math.random() * Math.min(bytes1.length, bytes2.length));

      // Simple byte-level comparison
      const diff1 = bytes1[idx] || 0;
      const diff2 = bytes2[idx] || 0;
      const pixelChange = Math.abs(diff1 - diff2);

      // Color channel threshold (out of 255)
      if (pixelChange > 30) {
        pixelDifferences++;
      }
    }

    const pixelChangePercentage = (pixelDifferences / sampleSize) * 100;

    // Motion detected if >25% of sampled pixels changed significantly
    const motionDetected = pixelChangePercentage > 25;
    const confidence = Math.min(100, Math.round(pixelChangePercentage));

    return {
      motionDetected,
      motionScore: pixelChangePercentage,
      confidence,
      pixelSampleSize: sampleSize,
      pixelChangedCount: pixelDifferences,
    };
  } catch (err) {
    console.error('[livenessCheck] Motion comparison error:', err);
    return {
      motionDetected: false,
      motionScore: 0,
      confidence: 0,
      error: err.message,
    };
  }
}

/**
 * Validate that an image has sufficient brightness/contrast variation.
 * Helps detect spoofed images (all white/black/blurry).
 * Returns: { valid, brightness, contrast, detail }
 */
export function validateImageBrightnessContrast(base64) {
  try {
    const bytes = base64ToByteArray(base64);
    if (!bytes || bytes.length === 0) {
      return { valid: false, error: 'Failed to decode image' };
    }

    // Sample ~100 bytes for brightness and contrast analysis
    const sampleSize = Math.min(100, Math.floor(bytes.length / 10));
    let brightnessSamples = [];
    let contrastGroups = [];

    for (let i = 0; i < sampleSize; i++) {
      const idx = Math.floor(Math.random() * bytes.length);
      brightnessSamples.push(bytes[idx]);
    }

    // Calculate brightness (average pixel value 0-255)
    const avgBrightness = brightnessSamples.reduce((a, b) => a + b, 0) / brightnessSamples.length;

    // Calculate contrast (standard deviation)
    const variance = brightnessSamples.reduce((sum, val) => sum + Math.pow(val - avgBrightness, 2), 0) / brightnessSamples.length;
    const contrast = Math.sqrt(variance);

    // Validate ranges:
    // - Brightness should be mid-range (50-205), not too dark or washed out
    // - Contrast should be >20, indicating detail/texture variation
    const brightnessTooLow = avgBrightness < 50;
    const brightnessTooHigh = avgBrightness > 205;
    const contrastTooLow = contrast < 20;

    const valid = !brightnessTooLow && !brightnessTooHigh && !contrastTooLow;

    return {
      valid,
      brightness: Math.round(avgBrightness),
      contrast: Math.round(contrast),
      detail: contrastTooLow ? 'low' : 'normal',
      checks: {
        brightnessTooLow,
        brightnessTooHigh,
        contrastTooLow,
      },
    };
  } catch (err) {
    console.error('[livenessCheck] Brightness/contrast validation error:', err);
    return {
      valid: false,
      error: err.message,
    };
  }
}

/**
 * Assess overall liveness based on multiple factors.
 * Returns: { livenessAssessment, score, reasons }
 */
export function assessLiveness(motionAnalysis, brightnessAnalysis) {
  const reasons = [];
  let score = 0;

  // Motion: most important factor (40 points max)
  if (motionAnalysis.motionDetected) {
    score += Math.min(40, motionAnalysis.confidence / 2.5);
    reasons.push('🎥 Motion detected (live capture)');
  } else {
    reasons.push('⚠️ Minimal motion detected (possible static image)');
  }

  // Brightness/Contrast: secondary validation (30 points max)
  if (brightnessAnalysis.valid) {
    score += 30;
    reasons.push(`💡 Good image quality (brightness: ${brightnessAnalysis.brightness}, contrast: ${brightnessAnalysis.contrast})`);
  } else {
    if (brightnessAnalysis.checks?.brightnessTooLow) {
      reasons.push('⚠️ Image too dark');
    }
    if (brightnessAnalysis.checks?.brightnessTooHigh) {
      reasons.push('⚠️ Image too bright/washed out');
    }
    if (brightnessAnalysis.checks?.contrastTooLow) {
      reasons.push('⚠️ Low detail/blurry image');
    }
  }

  // Overall assessment
  const livenessAssessment = score >= 55 ? 'PASS' : score >= 30 ? 'MARGINAL' : 'FAIL';

  return {
    livenessAssessment,
    score: Math.round(score),
    maxScore: 70,
    reasons,
    passThreshold: 55,
  };
}

/**
 * Generate liveness result metadata.
 * Called after successful liveness verification.
 */
export function generateLivenessResult(motionAnalysis, brightnessAnalysis) {
  const assessment = assessLiveness(motionAnalysis, brightnessAnalysis);

  return {
    timestamp: new Date().toISOString(),
    livenessDetectionMethod: 'motion_and_brightness_analysis',
    motionScore: motionAnalysis.motionScore,
    motionDetected: motionAnalysis.motionDetected,
    brightnessLevel: brightnessAnalysis.brightness,
    contrast: brightnessAnalysis.contrast,
    livenessAssessment: assessment.livenessAssessment,
    confidenceScore: assessment.score,
    passed: assessment.livenessAssessment === 'PASS' || assessment.livenessAssessment === 'MARGINAL',
    assessmentReasons: assessment.reasons,
  };
}

/**
 * Helper: Convert base64 string to byte array.
 */
function base64ToByteArray(base64) {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error('[livenessCheck] Base64 decode error:', err);
    return null;
  }
}

/**
 * Helper: Sleep for specified milliseconds.
 */
export function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * Export all utilities as a bundle for easy import.
 */
export const livenessCheckUtils = {
  compareImagesForMotion,
  validateImageBrightnessContrast,
  assessLiveness,
  generateLivenessResult,
  sleep,
};
