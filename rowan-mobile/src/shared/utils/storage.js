/**
 * Shared secure storage and preferences layer.
 * Uses Capacitor SecureStoragePlugin (Android Keystore / iOS Keychain)
 * with a localStorage fallback for web/dev.
 */
import { Preferences } from '@capacitor/preferences';

/* ── Secure Storage ── */

let SecurePlugin = null;

async function getPlugin() {
  if (SecurePlugin) return SecurePlugin;
  try {
    const mod = await import('capacitor-secure-storage-plugin');
    SecurePlugin = mod.SecureStoragePlugin;
    return SecurePlugin;
  } catch {
    return null;
  }
}

export async function getSecure(key) {
  const plugin = await getPlugin();
  if (plugin) {
    try {
      const { value } = await plugin.get({ key });
      return value ?? null;
    } catch {
      return null;
    }
  }
  /* localStorage fallback for web */
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setSecure(key, value) {
  const plugin = await getPlugin();
  if (plugin) {
    try {
      await plugin.set({ key, value: String(value) });
      return;
    } catch { /* fall through */ }
  }
  try {
    localStorage.setItem(key, String(value));
  } catch { /* storage write failed */ }
}

export async function removeSecure(key) {
  const plugin = await getPlugin();
  if (plugin) {
    try {
      await plugin.remove({ key });
      return;
    } catch { /* key may not exist */ }
  }
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export async function clearAllSecure() {
  const plugin = await getPlugin();
  if (plugin) {
    try {
      await plugin.clear();
      return;
    } catch { /* ignore */ }
  }
  try {
    localStorage.clear();
  } catch { /* ignore */ }
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
  } catch { /* write failure */ }
}

export async function clearPreferences() {
  try {
    await Preferences.clear();
  } catch { /* ignore */ }
}
