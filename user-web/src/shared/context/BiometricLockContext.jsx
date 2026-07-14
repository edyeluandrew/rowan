/**
 * Web biometric lock — no-op. Native biometrics are mobile-only.
 */
import { createContext, useContext, useState, useCallback } from 'react';

const BiometricLockContext = createContext(null);

export function BiometricLockProvider({ children }) {
  const [isLocked] = useState(false);
  const markUnlocked = useCallback(() => {}, []);
  const unlock = markUnlocked;
  const forceLock = useCallback(() => {}, []);
  const updateTimeout = useCallback(() => {}, []);
  const enableLock = useCallback(() => {}, []);
  const disableLock = useCallback(() => {}, []);

  return (
    <BiometricLockContext.Provider
      value={{
        isLocked,
        lockRequired: false,
        loading: false,
        markUnlocked,
        unlock,
        forceLock,
        updateTimeout,
        enableLock,
        disableLock,
        timeout: 0,
      }}
    >
      {children}
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLock() {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) throw new Error('useBiometricLock must be inside BiometricLockProvider');
  return ctx;
}
