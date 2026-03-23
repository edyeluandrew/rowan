/**
 * Shared secure storage and preferences layer.
 * Uses Capacitor SecureStoragePlugin (Android Keystore / iOS Keychain)
 * with a localStorage fallback for web/dev.
 * 
 * ⚠️ CRITICAL: Plugin loading is fully non-blocking and fire-and-forget.
 * App bootstrap is NEVER delayed by plugin initialization.
 */
import { Preferences } from '@capacitor/preferences';

/* ── Secure Storage ── */

let SecurePlugin = null;
let pluginInitAttempted = false;
let pluginReadyPromise = null;

/** 
 * Fire-and-forget plugin loader — initializes in background without blocking app.
 * NEVER awaited during bootstrap.
 */
function initPluginInBackground() {
  if (pluginInitAttempted || pluginReadyPromise) return;
  
  pluginInitAttempted = true;
  console.log('[Storage] Starting background plugin init...');
  
  // Start plugin load in background but DON'T WAIT for it
  pluginReadyPromise = (async () => {
    try {
      // Detect native vs web
      const isNative = typeof window !== 'undefined' 
        && window.Capacitor 
        && window.Capacitor.isNative;
      
      console.log('[Storage] Platform detection: isNative =', isNative);
      
      if (!isNative) {
        console.log('[Storage] Running on web, using localStorage only');
        return null;
      }
      
      console.log('[Storage] Initializing SecureStoragePlugin in background...');
      
      // Try to import plugin with timeout
      const pluginLoadPromise = import('capacitor-secure-storage-plugin')
        .then(mod => mod?.SecureStoragePlugin)
        .catch(err => {
          console.warn('[Storage] Plugin import failed:', err.message);
          return null;
        });
      
      // Wait max 3 seconds for plugin (don't block app)
      const plugin = await Promise.race([
        pluginLoadPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Plugin load timeout')), 3000)
        )
      ]).catch(err => {
        console.warn('[Storage] Plugin initialization timeout/failed:', err.message);
        return null;
      });
      
      if (plugin && typeof plugin.get === 'function') {
        SecurePlugin = plugin;
        console.log('[Storage] ✅ SecureStoragePlugin ready');
        return plugin;
      }
      
      console.warn('[Storage] Plugin available but not functional, falling back to localStorage');
      return null;
    } catch (err) {
      console.warn('[Storage] Unexpected plugin error:', err.message);
      return null;
    }
  })();
  
  // Don't wait — return immediately
  return pluginReadyPromise;
}

/** Get plugin without blocking — returns null immediately if not ready */
async function getPluginIfReady() {
  // If plugin already loaded, return it
  if (SecurePlugin) return SecurePlugin;
  
  // If init not started, start it now but DON'T WAIT
  if (!pluginInitAttempted) {
    initPluginInBackground();
  }
  
  // Try to get plugin with VERY SHORT timeout (50ms) — don't block operations
  if (pluginReadyPromise) {
    try {
      return await Promise.race([
        pluginReadyPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 50))
      ]);
    } catch {
      return null; // Fall back to localStorage immediately
    }
  }
  
  return null;
}

export async function getSecure(key) {
  /* ── FAST PATH: Try localStorage first (instant on web/mobile) ── */
  try {
    const value = localStorage.getItem(key);
    if (value) return value; // Found in localStorage, return immediately
  } catch { /* ignore */ }
  
  /* ── SLOW PATH: Only try plugin if localStorage didn't have it (non-blocking) ── */
  try {
    const plugin = await getPluginIfReady();
    if (plugin) {
      try {
        // Very aggressive timeout — don't wait for plugin
        const result = await Promise.race([
          plugin.get({ key }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
        ]);
        if (result?.value) {
          // Cache in localStorage for next time
          try { localStorage.setItem(key, result.value); } catch { /* ignore */ }
          return result.value;
        }
      } catch (err) {
        console.warn(`[Storage] getSecure plugin error for key "${key}":`, err.message);
      }
    }
  } catch (err) {
    console.warn('[Storage] getSecure error:', err.message);
  }
  
  return null;
}

export async function setSecure(key, value) {
  try {
    const plugin = await getPluginIfReady();
    if (plugin) {
      try {
        // Plugin call with short timeout
        await Promise.race([
          plugin.set({ key, value: String(value) }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin timeout')), 500))
        ]);
        return;
      } catch (err) {
        console.warn(`[Storage] setSecure plugin error for key "${key}":`, err.message);
        // Fall through to localStorage
      }
    }
  } catch (err) {
    console.warn('[Storage] setSecure error:', err.message);
  }
  
  /* localStorage fallback */
  try {
    localStorage.setItem(key, String(value));
  } catch { /* storage write failed */ }
}

export async function removeSecure(key) {
  try {
    const plugin = await getPluginIfReady();
    if (plugin) {
      try {
        await Promise.race([
          plugin.remove({ key }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin timeout')), 500))
        ]);
        return;
      } catch (err) {
        console.warn(`[Storage] removeSecure plugin error for key "${key}":`, err.message);
      }
    }
  } catch (err) {
    console.warn('[Storage] removeSecure error:', err.message);
  }
  
  /* localStorage fallback */
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

export async function clearAllSecure() {
  try {
    const plugin = await getPluginIfReady();
    if (plugin) {
      try {
        await Promise.race([
          plugin.clear(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin timeout')), 500))
        ]);
        return;
      } catch (err) {
        console.warn('[Storage] clearAllSecure plugin error:', err.message);
      }
    }
  } catch (err) {
    console.warn('[Storage] clearAllSecure error:', err.message);
  }
  
  /* localStorage fallback */
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

/** Export for manual initialization (called from AuthProvider to warm up plugin) */
export function initStorage() {
  initPluginInBackground();
}
