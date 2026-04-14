import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import OtpVerificationCard from '../../shared/components/twofactor/OtpVerificationCard';
import { verifyTwoFactorLogin } from '../api/twoFactor';

/**
 * WalletTwoFactorLoginModal — Wallet SEP-10 login 2FA verification modal
 * Shown after successful SEP-10 signature verification if 2FA is enabled
 * 
 * Props:
 * - isVisible: boolean
 * - userId: string (user ID from login response)
 * - onSuccess: (verifyCode) => Promise<void> (called after successful 2FA verification)
 * - onCancel: () => void (called if user goes back)
 */
export default function WalletTwoFactorLoginModal({
  isVisible,
  userId,
  onSuccess,
  onCancel,
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isVisible || !userId) return null;

  /**
   * Handle OTP verification
   * Calls verifyTwoFactorLogin to validate TOTP or backup code
   * Then calls onSuccess callback for the Register page to complete auth
   */
  const handleVerify = async (verifyCode) => {
    setLoading(true);
    setError(null);
    try {
      // Call backend to verify 2FA code (TOTP or backup code)
      const response = await verifyTwoFactorLogin(userId, verifyCode);
      
      // Backend returns: { verified: true, method: 'totp' | 'backup_code', backupCodesRemaining? }
      if (response?.verified === true) {
        // Success - pass the code back to parent for final auth completion
        setCode('');
        await onSuccess(verifyCode);
      } else {
        // This shouldn't happen with proper error handling, but be safe
        setError('Verification failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div
        className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onCancel}
            className="text-rowan-muted p-2 min-h-10 min-w-10 flex items-center justify-center"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-rowan-text text-lg font-bold flex-1">Verify Identity</h2>
        </div>

        {/* Content */}
        <OtpVerificationCard
          onSubmit={handleVerify}
          loading={loading}
          error={error}
          title="Enter Your Authentication Code"
          description="Enter the 6-digit code from your authenticator app or a backup code to complete login."
          submitText="Verify & Login"
          supportBackupCodes={true}
        />

        {/* Note */}
        <p className="text-rowan-muted text-xs mt-4 text-center">
          Don't have your authenticator app? Use a backup code instead.
        </p>
      </div>
    </div>
  );
}
