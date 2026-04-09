import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Download } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { useTwoFactor } from '../../hooks/useTwoFactor';
import OtpInput from '../../components/ui/OtpInput';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * TwoFactorSetup — Enable 2FA for trader account
 * Flow:
 * 1. Show QR code + manual key
 * 2. User enters verification code
 * 3. Show backup codes for download/copy
 */
export default function TwoFactorSetup() {
  const navigate = useNavigate();
  const { success: successToast, error: errorToast } = useToast();
  const { loading, error, setupData, backupCodes, startSetup, verifySetup, clearSetup } = useTwoFactor();

  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState('display'); // 'display', 'verify', 'complete'
  const [showManualKey, setShowManualKey] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Start setup on mount
  useEffect(() => {
    startSetup();
  }, [startSetup]);

  const handleVerifyCode = async () => {
    if (verificationCode.length < 6) {
      errorToast('Invalid Code', 'Please enter the 6-digit code');
      return;
    }

    const result = await verifySetup(verificationCode);
    if (result) {
      setStep('complete');
      successToast('2FA Enabled', '2FA has been successfully enabled on your account');
    }
  };

  const handleBackup = async () => {
    if (!backupCodes) return;

    const codesText = backupCodes.join('\n');
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(codesText)}`);
    element.setAttribute('download', 'rowan-backup-codes.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    successToast('Downloaded', 'Backup codes downloaded');
  };

  const handleCopyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    successToast('Copied', 'Backup codes copied to clipboard');
  };

  return (
    <div className="bg-rowan-bg min-h-screen pb-20">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Set Up Authentication</h1>
      </div>

      <div className="px-4 pt-6">
        {/* STEP 1: Display QR Code */}
        {step === 'display' && setupData && (
          <>
            <div className="text-center mb-6">
              <p className="text-rowan-muted text-sm mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="bg-white p-4 rounded-lg inline-block">
                <img src={setupData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            </div>

            {/* Manual Entry Option */}
            <button
              onClick={() => setShowManualKey(!showManualKey)}
              className="text-rowan-yellow text-sm text-center w-full mb-6 underline"
            >
              {showManualKey ? 'Hide' : 'Can\'t scan? Enter manually'}
            </button>

            {showManualKey && (
              <div className="bg-rowan-surface border border-rowan-border/50 rounded-lg p-4 mb-6">
                <p className="text-rowan-muted text-xs mb-2">Manual Entry Key:</p>
                <div className="flex items-center gap-2">
                  <code className="text-rowan-text font-mono text-sm flex-1 break-all">
                    {setupData.manualEntry}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.manualEntry);
                      successToast('Copied', 'Key copied to clipboard');
                    }}
                    className="text-rowan-yellow hover:text-rowan-yellow/80"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              onClick={() => setStep('verify')}
              className="w-full"
            >
              I've Scanned the Code
            </Button>
          </>
        )}

        {/* STEP 2: Verify Code */}
        {step === 'verify' && (
          <>
            <p className="text-rowan-muted text-sm text-center mb-6">
              Enter the 6-digit code from your authenticator app
            </p>

            <label className="block mb-2 text-rowan-muted text-xs">Verification Code</label>
            <OtpInput
              onComplete={(code) => setVerificationCode(code)}
              error={!!error}
            />

            {error && (
              <p className="text-rowan-red text-sm text-center mt-3">{error}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('display')}
                disabled={loading}
                className="flex-1 py-3 rounded-lg bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Back
              </button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleVerifyCode}
                loading={loading}
                className="flex-1"
              >
                Verify & Enable
              </Button>
            </div>
          </>
        )}

        {/* STEP 3: Success & Backup Codes */}
        {step === 'complete' && backupCodes && (
          <>
            <div className="bg-rowan-green/15 border border-rowan-green/30 rounded-lg p-4 mb-6">
              <p className="text-rowan-green font-semibold text-sm mb-2">✓ 2FA Enabled!</p>
              <p className="text-rowan-muted text-xs">
                Your account is now protected with two-factor authentication.
              </p>
            </div>

            <div className="mb-6">
              <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">
                Backup Codes
              </p>
              <p className="text-rowan-text text-sm mb-3">
                Save these codes in a safe place. Each code can be used once if you lose access to your authenticator.
              </p>

              <button
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                className="w-full py-3 rounded-lg bg-rowan-surface border border-rowan-border text-rowan-text text-sm font-medium mb-3"
              >
                {showBackupCodes ? 'Hide Codes' : 'Show Backup Codes'}
              </button>

              {showBackupCodes && (
                <div className="bg-rowan-surface border border-rowan-border rounded-lg p-4 mb-3">
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-rowan-muted mb-4">
                    {backupCodes.map((code, i) => (
                      <div key={i} className="text-rowan-text">{code}</div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyBackupCodes}
                      className="flex-1 py-2 rounded-lg bg-rowan-border text-rowan-text text-xs font-medium flex items-center justify-center gap-2"
                    >
                      <Copy size={14} />
                      Copy
                    </button>
                    <button
                      onClick={handleBackup}
                      className="flex-1 py-2 rounded-lg bg-rowan-border text-rowan-text text-xs font-medium flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                clearSetup();
                navigate('/security');
              }}
            >
              Done
            </Button>
          </>
        )}

        {/* Loading State */}
        {loading && step === 'display' && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingSpinner size={32} className="text-rowan-yellow" />
            <p className="text-rowan-muted text-sm mt-4">Setting up 2FA...</p>
          </div>
        )}
      </div>
    </div>
  );
}
