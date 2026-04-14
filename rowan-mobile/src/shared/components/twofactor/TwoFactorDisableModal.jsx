import { AlertTriangle } from 'lucide-react';
import OtpVerificationCard from './OtpVerificationCard';
import LoadingSpinner from "../../../wallet/components/ui/LoadingSpinner";

/**
 * TwoFactorDisableModal — Shared disable 2FA modal
 * Requires TOTP verification to prevent accidental disabling
 * 
 * Props:
 * - isVisible: boolean
 * - onClose: () => void
 * - onDisable: (code) => Promise<{ disabled: true }>
 * - isLoading: boolean
 * - error: string | null
 * - onDisableSuccess?: () => void
 */
export default function TwoFactorDisableModal({
  isVisible,
  onClose,
  onDisable,
  isLoading = false,
  error = null,
  onDisableSuccess,
}) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div
        className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Warning */}
        <div className="flex items-start gap-3 mb-6 p-4 bg-rowan-red/10 border border-rowan-red/30 rounded-xl">
          <AlertTriangle size={20} className="text-rowan-red shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-red font-semibold text-sm">Disable 2FA?</h3>
            <p className="text-rowan-muted text-xs mt-1">
              Your account will be less secure. You can re-enable 2FA anytime.
            </p>
          </div>
        </div>

        {/* Verification */}
        <div className="mb-6">
          <p className="text-rowan-muted text-sm mb-4">
            To confirm, enter your 6-digit authentication code:
          </p>
          <OtpVerificationCard
            onSubmit={async (code) => {
              await onDisable(code);
              onDisableSuccess?.();
              onClose();
            }}
            loading={isLoading}
            error={error}
            title=""
            description=""
            submitText="Disable 2FA"
            disabled={isLoading}
          />
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="w-full py-3 rounded-xl border border-rowan-border text-rowan-text text-sm font-medium transition-colors disabled:opacity-50 min-h-11"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
