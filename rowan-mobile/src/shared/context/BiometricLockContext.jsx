/**
 * BiometricLockContext — global lock state and lifecycle integration.
 *
 * This context manages:
 * - Whether the app is currently locked/unlocked
 * - When biometric unlock is required
 * - Timeout tracking and auto-lock behavior
 * - Integration with app pause/resume lifecycle
 *
 * This is NOT auth — auth is handled by AuthContext.
 * This is a LOCAL device protection layer on top of existing auth.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { getPreference, setPreference } from '../utils/storage';

const BiometricLockContext = createContext(null);

/**
 * BiometricLockProvider — wraps the app and handles lifecycle events.
 * Should be mounted at the root level, typically in main.jsx or App.jsx.
 */
export function BiometricLockProvider({ children }) {
  const [isLocked, setIsLocked] = useState(false);
  const [lockRequired, setLockRequired] = useState(false);
  const [lastUnlockTime, setLastUnlockTime] = useState(null);
  const [timeout, setTimeout] = useState(0); // timeout in seconds (0 = lock immediately)
  const [loading, setLoading] = useState(true);

  // Load preferences on mount
  useEffect(() => {
    (async () => {
      try {
        const biometricEnabled = await getPreference('rowan_biometric_enabled');
        const timeoutSetting = await getPreference('rowan_biometric_timeout');
        
        if (biometricEnabled === 'true') {
          setLockRequired(true);
          setTimeout(parseInt(timeoutSetting || '0', 10));
        }
      } catch (err) {
        console.warn('[BiometricLock] Failed to load preferences:', err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Handle app resume (Capacitor lifecycle)
  useEffect(() => {
    if (!lockRequired) return;

    const unsubscribe = CapacitorApp.addListener('resume', () => {
      console.log('[BiometricLock] App resumed, checking lock status');
      
      // Check if already unlocked within timeout window
      if (lastUnlockTime) {
        const elapsedSeconds = (Date.now() - lastUnlockTime) / 1000;
        if (timeout === 0 || elapsedSeconds > timeout) {
          // Timeout expired, lock again
          console.log(`[BiometricLock] Lock timeout expired (${elapsedSeconds}s > ${timeout}s), locking app`);
          setIsLocked(true);
        } else {
          console.log(`[BiometricLock] Still within lock timeout (${elapsedSeconds}s < ${timeout}s), staying unlocked`);
        }
      } else {
        // First app resume, always lock
        console.log('[BiometricLock] First resume with biometric enabled, locking app');
        setIsLocked(true);
      }
    });

    return () => unsubscribe?.remove();
  }, [lockRequired, timeout, lastUnlockTime]);

  // Handle app pause (Capacitor lifecycle)
  useEffect(() => {
    if (!lockRequired) return;

    const unsubscribe = CapacitorApp.addListener('pause', () => {
      console.log('[BiometricLock] App paused');
      // Don't lock immediately on pause, only on resume after timeout
    });

    return () => unsubscribe?.remove();
  }, [lockRequired]);

  /**
   * Call this after successful biometric verification to unlock the app.
   * Records the unlock time for timeout tracking.
   */
  const unlock = useCallback(() => {
    console.log('[BiometricLock] unlock() called');
    console.log('[BiometricLock] Current isLocked:', isLocked);
    setLastUnlockTime(Date.now());
    setIsLocked(false);
    console.log('[BiometricLock] Set isLocked to false');
  }, [isLocked]);

  /**
   * Manually lock the app (e.g., user clicks logout).
   */
  const lock = useCallback(() => {
    console.log('[BiometricLock] Locking app');
    setIsLocked(true);
    setLastUnlockTime(null);
  }, []);

  /**
   * Enable biometric lock and optionally set timeout.
   */
  const enableLock = useCallback(async (timeoutSeconds = 0) => {
    console.log(`[BiometricLock] Enabling lock with timeout ${timeoutSeconds}s`);
    await setPreference('rowan_biometric_enabled', 'true');
    await setPreference('rowan_biometric_timeout', String(timeoutSeconds));
    setLockRequired(true);
    setTimeout(timeoutSeconds);
    lock(); // Lock immediately when enabling
  }, [lock]);

  /**
   * Disable biometric lock.
   */
  const disableLock = useCallback(async () => {
    console.log('[BiometricLock] Disabling lock');
    await setPreference('rowan_biometric_enabled', 'false');
    setLockRequired(false);
    setIsLocked(false);
    setLastUnlockTime(null);
  }, []);

  return (
    <BiometricLockContext.Provider
      value={{
        isLocked,
        lockRequired,
        timeout,
        loading,
        unlock,
        lock,
        enableLock,
        disableLock,
      }}
    >
      {children}
    </BiometricLockContext.Provider>
  );
}

/**
 * Hook to access biometric lock context.
 */
export function useBiometricLock() {
  const context = useContext(BiometricLockContext);
  if (!context) {
    throw new Error('useBiometricLock must be used within BiometricLockProvider');
  }
  return context;
}
