/**
 * useBiometricProtection — hook to wrap sensitive screens with biometric lock.
 *
 * Usage:
 *   const { isLocked } = useBiometricProtection();
 *   if (isLocked) return <BiometricLock />;
 *   return <YourActualScreen />;
 *
 * Or use the ProtectedScreen component wrapper for convenience.
 */

import { useBiometricLock } from '../context/BiometricLockContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Hook to check if current screen should be locked.
 * Returns true if:
 * - User is authenticated
 * - Biometric lock is enabled
 * - App is currently locked
 */
export function useBiometricProtection() {
  const { isAuthenticated } = useAuth();
  const { isLocked, lockRequired } = useBiometricLock();

  // Lock applies only to authenticated users with biometric enabled
  const shouldLock = isAuthenticated && lockRequired && isLocked;

  return {
    isLocked: shouldLock,
    lockRequired,
  };
}

export default useBiometricProtection;
