/**
 * BiometricLock — full-screen lock UI shown when app requires biometric unlock.
 * 
 * Features:
 * - Auto-retry after first failed attempt (user-friendly)
 * - Attempt counter (max 3 suggested)
 * - Success state with auto-dismiss
 * - Auto-hides when isLocked becomes false
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import useBiometrics from '../../wallet/hooks/useBiometrics';
import { useBiometricLock } from '../context/BiometricLockContext';
import Button from '../../wallet/components/ui/Button';
import { Fingerprint, ScanFace, Lock, LogOut, CheckCircle } from 'lucide-react';

export default function BiometricLock() {
  const { logout } = useAuth();
  const { unlock: unlockApp, isLocked } = useBiometricLock();
  const { authenticate, biometricType } = useBiometrics();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [autoRetryTimer, setAutoRetryTimer] = useState(null);

  const biometricLabel = biometricType === 'FACE_ID' ? 'Face ID' : 'Fingerprint';
  const BiometricIcon = biometricType === 'FACE_ID' ? ScanFace : Fingerprint;

  // Auto-dismiss when unlocked
  useEffect(() => {
    if (!isLocked) {
      console.log('[BiometricLock] isLocked is false, component will unmount');
    }
  }, [isLocked]);

  // Auto-retry after first failure (better UX)
  useEffect(() => {
    if (error && attemptCount === 1 && !autoRetryTimer) {
      console.log('[BiometricLock] Scheduling auto-retry after first failure...');
      const timer = setTimeout(() => {
        console.log('[BiometricLock] Auto-retrying...');
        setError(null);
        handleVerify();
      }, 2000);
      setAutoRetryTimer(timer);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [error, attemptCount]);

  const handleVerify = async () => {
    if (autoRetryTimer) {
      clearTimeout(autoRetryTimer);
      setAutoRetryTimer(null);
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[BiometricLock] Verification attempt #${attemptCount + 1}...`);
      const verified = await authenticate(`Unlock Rowan to continue`);

      if (verified) {
        console.log('[BiometricLock] ✅ Verification succeeded!');
        setSuccess(true);
        
        // Small delay for UX feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[BiometricLock] Calling unlockApp()');
        unlockApp();
      } else {
        // Failed/cancelled
        const newCount = attemptCount + 1;
        setAttemptCount(newCount);
        console.log(`[BiometricLock] Attempt ${newCount} failed/cancelled`);

        if (newCount < 3) {
          setError(`Try again (attempt ${newCount})`);
        } else {
          setError('Failed. Please try again or log out.');
        }
      }
    } catch (err) {
      console.error('[BiometricLock] Error:', err);
      const newCount = attemptCount + 1;
      setAttemptCount(newCount);
      setError(newCount >= 3 ? err.message : `Try again (attempt ${newCount})`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out?')) {
      await logout();
    }
  };

  // If not locked, don't show anything (auto-hides)
  if (!isLocked) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-rowan-bg flex flex-col items-center justify-center px-6 pb-24">
      {/* Success state */}
      {success ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle size={64} className="text-rowan-green mb-4" />
          <h1 className="text-rowan-text text-2xl font-bold">Verified!</h1>
          <p className="text-rowan-muted text-sm mt-2">Welcome back</p>
        </div>
      ) : (
        <>
          {/* Lock icon */}
          <Lock size={64} className="text-rowan-yellow mb-6" />

          {/* Title */}
          <h1 className="text-rowan-text text-2xl font-bold text-center mb-2">
            App Locked
          </h1>
          <p className="text-rowan-muted text-center mb-8">
            Verify your {biometricLabel} to continue
          </p>

          {/* Loading/Scanning state */}
          {loading && (
            <div className="mb-6 flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-rowan-yellow border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-rowan-muted text-sm">
                {attemptCount === 0 ? 'Ready for scan...' : 'Scanning...'}
              </p>
            </div>
          )}

          {/* Biometric button */}
          {!loading && (
            <Button
              onClick={handleVerify}
              variant="primary"
              size="lg"
              className="w-full mb-4"
            >
              <BiometricIcon size={20} className="inline mr-2" />
              {attemptCount === 0
                ? `Verify ${biometricLabel}`
                : `Try Again (${attemptCount})`}
            </Button>
          )}

          {/* Error/Status message */}
          {error && (
            <div className={`w-full rounded-lg p-4 text-center mb-4 ${
              attemptCount < 3
                ? 'bg-rowan-yellow bg-opacity-10 border border-rowan-yellow'
                : 'bg-rowan-red bg-opacity-10 border border-rowan-red'
            }`}>
              <p className={`text-sm font-medium ${
                attemptCount < 3 ? 'text-rowan-yellow' : 'text-rowan-red'
              }`}>
                {error}
              </p>
              {attemptCount < 3 && (
                <p className="text-xs text-rowan-muted mt-1">
                  Auto-retrying in a moment...
                </p>
              )}
            </div>
          )}

          {/* Logout fallback */}
          <button
            onClick={handleLogout}
            disabled={loading}
            className="flex items-center justify-center gap-2 mt-8 text-rowan-muted hover:text-rowan-red text-sm disabled:opacity-50 transition-colors"
          >
            <LogOut size={16} />
            Log out instead
          </button>

          {/* Privacy notice */}
          <p className="text-rowan-muted text-xs text-center mt-12 max-w-xs">
            Your biometric data is processed locally on your device and never sent to our servers.
          </p>
        </>
      )}
    </div>
  );
}

