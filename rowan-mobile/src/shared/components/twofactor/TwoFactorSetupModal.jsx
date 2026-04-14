import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import QrDisplay from './QrDisplay';
import OtpVerificationCard from './OtpVerificationCard';
import BackupCodesDisplay from './BackupCodesDisplay';
import LoadingSpinner from "../../../wallet/components/ui/LoadingSpinner";

/**
 * TwoFactorSetupModal — Shared 2FA setup flow modal
 * Reusable for both trader and wallet users
 * 
 * Props:
 * - isVisible: boolean
 * - onClose: () => void
 * - onSetupInitiate: () => Promise<{ qrCode, manualEntry, setupId }>
 * - onSetupVerify: (code) => Promise<{ backupCodes, message }>
 * - isLoading: boolean
 * - error: string | null
 * - onSetupSuccess?: (backupCodes) => void
 */
export default function TwoFactorSetupModal({
  isVisible,
  onClose,
  onSetupInitiate,
  onSetupVerify,
  isLoading = false,
  error = null,
  onSetupSuccess,
}) {
  const [step, setStep] = useState('idle'); // 'idle' | 'loading' | 'qr' | 'verify' | 'backup_codes'
  const [qrCode, setQrCode] = useState(null);
  const [manualEntry, setManualEntry] = useState(null);
  const [setupId, setSetupId] = useState(null);
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyError, setVerifyError] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleStart = async () => {
    setStep('loading');
    try {
      const data = await onSetupInitiate();
      setQrCode(data.qrCode);
      setManualEntry(data.manualEntry);
      setSetupId(data.setupId);
      setStep('qr');
    } catch (err) {
      setVerifyError(err.message || 'Failed to initialize setup');
      setStep('idle');
    }
  };

  const handleVerifyCode = async (code) => {
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      const data = await onSetupVerify(code);
      setBackupCodes(data.backupCodes || []);
      setStep('backup_codes');
    } catch (err) {
      setVerifyError(err.message || 'Verification failed');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleBackupCodesDone = () => {
    onSetupSuccess?.(backupCodes);
    handleClose();
  };

  const handleClose = () => {
    setStep('idle');
    setQrCode(null);
    setManualEntry(null);
    setSetupId(null);
    setBackupCodes([]);
    setVerifyError(null);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div
        className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {step !== 'idle' && step !== 'loading' && (
            <button
              onClick={() =>
                step === 'backup_codes'
                  ? setStep('verify')
                  : step === 'verify'
                    ? setStep('qr')
                    : handleClose()
              }
              className="text-rowan-muted p-2 min-h-10 min-w-10 flex items-center justify-center"
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <h2 className="text-rowan-text text-lg font-bold flex-1 text-center">
            {step === 'idle' && 'Enable 2FA'}
            {step === 'loading' && 'Setting Up...'}
            {step === 'qr' && 'Scan Authenticator'}
            {step === 'verify' && 'Verify Code'}
            {step === 'backup_codes' && 'Backup Codes'}
          </h2>
          <div className="w-10" />
        </div>

        {/* Content */}
        <div className="space-y-6">
          {step === 'idle' && (
            <>
              <p className="text-rowan-muted text-sm leading-relaxed">
                Two-factor authentication adds an extra layer of security to your account. You'll need to enter a code from an authenticator app when signing in.
              </p>
              <button
                onClick={handleStart}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-sm transition-opacity disabled:opacity-50 min-h-11"
              >
                {isLoading ? 'Preparing...' : 'Set Up 2FA'}
              </button>
              {error && (
                <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red text-sm rounded-lg p-3">
                  {error}
                </div>
              )}
            </>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <LoadingSpinner size={32} className="text-rowan-yellow" />
              <p className="text-rowan-muted text-sm">Generating your 2FA setup...</p>
            </div>
          )}

          {step === 'qr' && (
            <>
              <QrDisplay qrCode={qrCode} manualEntry={manualEntry} />
              <button
                onClick={() => setStep('verify')}
                className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-sm transition-opacity min-h-11"
              >
                I've Scanned the Code
              </button>
            </>
          )}

          {step === 'verify' && (
            <OtpVerificationCard
              onSubmit={handleVerifyCode}
              loading={verifyLoading}
              error={verifyError}
              title="Verify Your Setup"
              description="Enter the 6-digit code from your authenticator app"
              submitText="Verify & Continue"
            />
          )}

          {step === 'backup_codes' && (
            <>
              <BackupCodesDisplay codes={backupCodes} />
              <button
                onClick={handleBackupCodesDone}
                className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-sm transition-opacity min-h-11"
              >
                I've Saved My Codes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
