/**
 * permissions.js — Capacitor permission utilities for camera and gallery access.
 * Provides permission checking, requesting, and handling for mobile apps.
 */

import { Camera as CapCamera } from '@capacitor/camera';

/**
 * Check and request camera permission.
 * Returns: { granted: boolean, error?: string, settingsUrl?: string }
 */
export async function requestCameraPermission() {
  try {
    const perms = await CapCamera.checkPermissions();

    // If already granted, return success
    if (perms.camera === 'granted') {
      return { granted: true };
    }

    // If denied/prompt, request permission
    if (perms.camera === 'denied') {
      return {
        granted: false,
        error: 'Camera permission was denied. Enable it in Settings to take photos.',
        settingsUrl: 'app-settings://',
      };
    }

    // Prompt user (camera === 'prompt')
    const requestResult = await CapCamera.requestPermissions({ permissions: ['camera'] });
    if (requestResult.camera === 'granted') {
      return { granted: true };
    }

    return {
      granted: false,
      error: 'Camera permission is required to take photos.',
      settingsUrl: 'app-settings://',
    };
  } catch (err) {
    console.error('[Permissions] Camera check error:', err);
    return {
      granted: false,
      error: 'Failed to check camera permission. Please try again.',
    };
  }
}

/**
 * Check and request gallery/photos permission.
 * Returns: { granted: boolean, error?: string, settingsUrl?: string }
 */
export async function requestPhotosPermission() {
  try {
    const perms = await CapCamera.checkPermissions();

    if (perms.photos === 'granted') {
      return { granted: true };
    }

    if (perms.photos === 'denied') {
      return {
        granted: false,
        error: 'Gallery permission was denied. Enable it in Settings to select photos.',
        settingsUrl: 'app-settings://',
      };
    }

    const requestResult = await CapCamera.requestPermissions({ permissions: ['photos'] });
    if (requestResult.photos === 'granted') {
      return { granted: true };
    }

    return {
      granted: false,
      error: 'Gallery permission is required to select photos.',
      settingsUrl: 'app-settings://',
    };
  } catch (err) {
    console.error('[Permissions] Gallery check error:', err);
    return {
      granted: false,
      error: 'Failed to check gallery permission. Please try again.',
    };
  }
}

/**
 * Format permission error for user display.
 */
export function formatPermissionError(error, hasSettingsUrl) {
  if (!error) return null;
  return hasSettingsUrl
    ? `${error} You can enable it in your device Settings.`
    : error;
}
