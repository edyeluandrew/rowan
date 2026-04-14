import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import OtpInput from '../../../trader/components/ui/OtpInput';
import FlexibleOtpInput from '../../ui/FlexibleOtpInput';
import LoadingSpinner from '../../../wallet/components/ui/LoadingSpinner';

/**
 * OtpVerificationCard — Reusable OTP input + submit for 2FA verification
 * Can be embedded in pages or modals for both trader and wallet users
 * Supports TOTP codes (6-digit) and backup codes (8-char alphanumeric)
 * 
 * Props:
 * - onSubmit: (code) => Promise
 * - loading: boolean
 * - error: string | null
 * - title: string (e.g., "Enter Authentication Code")
 * - description: string (e.g., "Enter the 6-digit code from your authenticator app")
 * - submitText: string (default: "Verify")
 * - disabled: boolean
 * - supportBackupCodes: boolean (default: true) - show toggle for backup codes
 */
export default function OtpVerificationCard({
  onSubmit,
  loading = false,
  error = null,
  title = 'Enter Authentication Code',
  description = 'Enter the 6-digit code from your authenticator app or a backup code',
  submitText = 'Verify',
  disabled = false,
  supportBackupCodes = true,
}) {
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleSubmit = async () => {
    if (useBackupCode && code.length < 8) return;
    if (!useBackupCode && code.length < 6) return;
    await onSubmit(code);
    setCode('');
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h3 className="text-rowan-text text-lg font-semibold mb-2">{title}</h3>
        <p className="text-rowan-muted text-sm leading-relaxed">{description}</p>
      </div>

      {/* Code input - show appropriate component based on mode */}
      <div className="mb-6">
        {useBackupCode ? (
          <FlexibleOtpInput
            onComplete={(val) => setCode(val)}
            error={!!error}
            disabled={loading || disabled}
            mode="backup"
          />
        ) : (
          <OtpInput
            onComplete={(val) => setCode(val)}
            error={!!error}
            disabled={loading || disabled}
          />
        )}
      </div>

      {/* Toggle backup code mode */}
      {supportBackupCodes && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
            }}
            disabled={loading || disabled}
            className="flex items-center gap-2 text-rowan-yellow text-xs hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            <ChevronDown
              size={14}
              style={{
                transform: useBackupCode ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
            <span>{useBackupCode ? 'Use Authenticator Code' : 'Use Backup Code'}</span>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || disabled || (useBackupCode ? code.length < 8 : code.length < 6)}
        className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-sm transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-11"
      >
        {loading ? (
          <>
            <LoadingSpinner size={16} className="text-rowan-bg" />
            Verifying...
          </>
        ) : (
          submitText
        )}
      </button>
    </div>
  );
}
