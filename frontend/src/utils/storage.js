import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import { Preferences } from '@capacitor/preferences';

/* ── Secure Storage (hardware-encrypted) ── */

export async function getSecure(key) {
  try {
    const { value } = await SecureStoragePlugin.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

export async function setSecure(key, value) {
  try {
    await SecureStoragePlugin.set({ key, value: String(value) });
  } catch {
    /* write failure — secure storage unavailable */
  }
}

export async function removeSecure(key) {
  try {
    await SecureStoragePlugin.remove({ key });
  } catch {
    /* key may not exist — safe to ignore */
  }
}

export async function clearAllSecure() {
  try {
    await SecureStoragePlugin.clear();
  } catch {
    /* ignore */
  }
}

/* ── Preferences (non-sensitive UI preferences) ── */

export async function getPreference(key, defaultValue = null) {
  try {
    const { value } = await Preferences.get({ key });
    return value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setPreference(key, value) {
  try {
    await Preferences.set({ key, value: String(value) });
  } catch {
    /* write failure — preferences unavailable */
  }
}

export async function clearPreferences() {
  try {
    await Preferences.clear();
  } catch {
    /* ignore */
  }
}
