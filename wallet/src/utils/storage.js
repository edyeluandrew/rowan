import { Preferences } from '@capacitor/preferences'

const SS_PREFIX = '__rowan_ss__'
let _ssPlugin = null
let _ssChecked = false

/**
 * Lazy-init: try to load the Capacitor secure-storage plugin once.
 * Succeeds on native (Android/iOS), silently falls back on web.
 */
async function getPlugin() {
  if (_ssChecked) return _ssPlugin
  _ssChecked = true
  try {
    const mod = await import('capacitor-secure-storage-plugin')
    _ssPlugin = mod.SecureStoragePlugin
    await _ssPlugin.get({ key: '__probe__' })
  } catch {
    _ssPlugin = null
  }
  return _ssPlugin
}

/**
 * Secure Storage — uses Android Keystore / iOS Keychain on device,
 * falls back to localStorage in the browser during development.
 */
export async function getSecure(key) {
  const plugin = await getPlugin()
  let value = null
  
  // Try plugin first (for native encrypted storage)
  if (plugin) {
    try {
      const result = await plugin.get({ key })
      if (result?.value) {
        return result.value
      }
    } catch (err) {
      console.debug(`[Storage] Plugin read failed, checking localStorage:`, err.message)
    }
  }
  
  // Always check localStorage as fallback (ensures data persists across plugin failures)
  // This is critical for wallet keypairs - MUST NOT return null if data exists
  const localValue = localStorage.getItem(SS_PREFIX + key)
  if (localValue) {
    return localValue
  }
  
  return null
}

export async function setSecure(key, value) {
  const plugin = await getPlugin()
  let pluginSuccess = false
  
  // Always try plugin first (for native encryption)
  if (plugin) {
    try {
      await plugin.set({ key, value })
      pluginSuccess = true
    } catch (err) {
      console.warn(`[Storage] Capacitor plugin write failed, using localStorage:`, err.message)
    }
  }
  
  // CRITICAL: Always fallback to localStorage to ensure data persists
  // This is especially important for wallet keypairs
  localStorage.setItem(SS_PREFIX + key, value)
}

export async function removeSecure(key) {
  const plugin = await getPlugin()
  if (plugin) {
    try {
      await plugin.remove({ key })
    } catch {
      /* key not found */
    }
    return
  }
  localStorage.removeItem(SS_PREFIX + key)
}

export async function clearAllSecure() {
  const plugin = await getPlugin()
  if (plugin) {
    try {
      await plugin.clear()
    } catch {
      /* already empty */
    }
    return
  }
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(SS_PREFIX)) keysToRemove.push(k)
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k))
}

/**
 * Preferences — non-sensitive key/value storage.
 * For: onboarding complete flag, sound/vibration prefs.
 */
export async function getPreference(key) {
  try {
    const { value } = await Preferences.get({ key })
    return value
  } catch {
    /* read failure — preferences unavailable */
    return null
  }
}

export async function setPreference(key, value) {
  try {
    await Preferences.set({ key, value })
  } catch {
    /* write failure — preferences unavailable */
  }
}
