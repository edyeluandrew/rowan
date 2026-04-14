import { RefreshCw } from 'lucide-react';
import OtpVerificationCard from './OtpVerificationCard';
import BackupCodesDisplay from './BackupCodesDisplay';

/**
 * TwoFactorRegenerateModal — Shared regenerate backup codes modal
 * Requires TOTP verification, then shows new codes
 * 
 * Props:
 * - isVisible: boolean
 * - onClose: () => void
 * - onRegenerate: (code) => Promise<{ backupCodes, backupCodesRemaining }>
 * - isLoading: boolean
 * - error: string | null
 * - step: 'verify' | 'codes' (to track modal step)
 * - newCodes: string[]
 * - onRegenerateSuccess?: (codes) => void
 */
export default function TwoFactorRegenerateModal({
  isVisible,
  onClose,
  onRegenerate,
  isLoading = false,
  error = null,
  step = 'verify',
  newCodes = [],
  onRegenerateSuccess,
}) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div
        className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <RefreshCw size={20} className="text-rowan-yellow" />
          <h2 className="text-rowan-text text-lg font-bold">
            {step === 'verify' ? 'Regenerate Backup Codes' : 'New Backup Codes'}
          </h2>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {step === 'verify' && (
            <>
              <p className="text-rowan-muted text-sm">
                Your old backup codes will no longer work. To generate new codes, verify your identity with your authentication code:
              </p>
              <OtpVerificationCard
                onSubmit={onRegenerate}
                loading={isLoading}
                error={error}
                title=""
                description=""
                submitText="Generate New Codes"
              />
            </>
          )}

          {step === 'codes' && (
            <>
              <BackupCodesDisplay
                codes={newCodes}
                title="New Backup Codes Generated"
                description="Your old codes are no longer valid. Save these new codes in a secure location."
              />
              <button
                onClick={() => {
                  onRegenerateSuccess?.(newCodes);
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-sm transition-opacity min-h-11"
              >
                I've Saved the New Codes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
