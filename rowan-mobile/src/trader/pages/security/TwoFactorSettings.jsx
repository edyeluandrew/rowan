import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Check, Shield, AlertTriangle } from 'lucide-react';
import {
  check2faStatus,
  initiate2faSetup,
  verifyTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
} from '../../api/twoFactor';
import OtpInput from '../../components/ui/OtpInput';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

/**
 * TwoFactorSettings — Mobile trader 2FA management
 * Enable/disable 2FA, show QR code, backup codes, etc.
 */
export default function TwoFactorSettings() {
  const navigate = useNavigate();

  // Status check
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  // Setup flow
  const [showSetup, setShowSetup] = useState(false);
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Backup codes regenerate
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [regenerateError, setRegenerateError] = useState(null);
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState([]);

  // Copy to clipboard
  const [copiedIndices, setCopiedIndices] = useState(new Set());

  // Load status on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await check2faStatus();
        setStatus(data);
      } catch (err) {
        setStatusError(err.message || 'Failed to load 2FA status');
        // Assume not enabled on error
        setStatus({ isEnabled: false });
      } finally {
        setStatusLoading(false);
      }
    })();
  }, []);

  // === ENABLE 2FA ===
  const handleEnableClick = async () => {
    setSetupLoading(true);
    try {
      const data = await initiate2faSetup();
      setSecret(data.secret);
      setQrCode(data.qrCode);
      setShowSetup(true);
    } catch (err) {
      setSetupError(err.response?.data?.error || 'Failed to generate 2FA secret');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (setupCode.length < 6) {
      setSetupError('Please enter the 6-digit code');
      return;
    }

    setSetupLoading(true);
    setSetupError(null);
    try {
      const data = await verifyTwoFactorSetup(setupCode);
      setBackupCodes(data.backupCodes || []);
      setStatus({ isEnabled: true });
      setShowSetup(false);
    } catch (err) {
      setSetupError(err.response?.data?.error || 'Verification failed');
    } finally {
      setSetupLoading(false);
    }
  };

  // === DISABLE 2FA ===
  const handleDisableClick = () => {
    setShowDisable(true);
  };

  const handleConfirmDisable = async () => {
    if (disableCode.length < 6) {
      setDisableError('Please enter the 6-digit code');
      return;
    }

    setDisableLoading(true);
    setDisableError(null);
    try {
      await disableTwoFactor(disableCode);
      setStatus({ isEnabled: false });
      setShowDisable(false);
      setDisableCode('');
    } catch (err) {
      setDisableError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  // === REGENERATE BACKUP CODES ===
  const handleRegenerateClick = () => {
    setShowRegenerateModal(true);
  };

  const handleConfirmRegenerate = async () => {
    if (regenerateCode.length < 6) {
      setRegenerateError('Please enter the 6-digit code');
      return;
    }

    setRegenerateLoading(true);
    setRegenerateError(null);
    try {
      const data = await regenerateBackupCodes(regenerateCode);
      setNewBackupCodes(data.backupCodes || []);
    } catch (err) {
      setRegenerateError(err.response?.data?.error || 'Failed to regenerate codes');
    } finally {
      setRegenerateLoading(false);
    }
  };

  // === COPY TO CLIPBOARD ===
  const copyToClipboard = (code, idx) => {
    navigator.clipboard.writeText(code);
    const newSet = new Set(copiedIndices);
    newSet.add(idx);
    setCopiedIndices(newSet);
    setTimeout(() => {
      setCopiedIndices((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }, 2000);
  };

  if (statusLoading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-rowan-bg border-b border-rowan-border flex items-center gap-3 px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="text-rowan-text p-1 -ml-1 min-h-10 min-w-10 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Two-Factor Auth</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Status Card */}
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 md:p-5">
          <div className="flex items-center gap-3 mb-3">
            <Shield size={20} className="text-rowan-yellow" />
            <span className="text-rowan-text font-semibold">Status</span>
          </div>
          <p className="text-rowan-muted text-sm">
            {status?.isEnabled
              ? '✓ Two-factor authentication is enabled. Your account is protected.'
              : '✗ Two-factor authentication is disabled. Enable it for better security.'}
          </p>
        </div>

        {/* Information */}
        <div className="bg-rowan-surface/50 border border-rowan-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
            <div className="text-xs md:text-sm text-rowan-muted space-y-2">
              <p>
                <strong>What is 2FA?</strong> Two-Factor Authentication adds an extra security step by requiring a code from your authenticator app when signing in.
              </p>
              <p>
                <strong>Supported apps:</strong> Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.
              </p>
              <p>
                <strong>Backup codes:</strong> Keep your backup codes safe. You can use them to sign in if you lose access to your authenticator.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {status?.isEnabled && !showRegenerateModal && (
          <div className="space-y-3">
            <Button
              variant="danger"
              onClick={handleDisableClick}
              className="w-full"
              loading={disableLoading}
            >
              Disable 2FA
            </Button>
            <button
              onClick={handleRegenerateClick}
              className="w-full py-3 rounded-xl border border-rowan-border text-rowan-text font-medium text-sm active:bg-rowan-surface transition-colors"
            >
              Regenerate Backup Codes
            </button>
          </div>
        )}

        {!status?.isEnabled && !showSetup && (
          <Button
            variant="primary"
            onClick={handleEnableClick}
            className="w-full"
            loading={setupLoading}
          >
            Enable 2FA
          </Button>
        )}

        {statusError && !status?.isEnabled && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
            <p className="text-rowan-red text-sm">{statusError}</p>
          </div>
        )}
      </div>

      {/* === SETUP MODAL === */}
      {showSetup && !backupCodes.length && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-rowan-text font-semibold text-lg">Enable Two-Factor Auth</h2>

            {/* Step 1: QR Code */}
            <div className="space-y-3">
              <p className="text-rowan-muted text-sm font-medium">Step 1: Scan QR code</p>
              {qrCode && (
                <div className="flex justify-center p-3 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code" className="w-40 h-40" />
                </div>
              )}
            </div>

            {/* Step 2: Manual key */}
            <div className="space-y-2">
              <p className="text-rowan-muted text-sm font-medium">Or enter key manually:</p>
              <div className="bg-rowan-bg border border-rowan-border rounded-lg p-3 font-mono text-xs text-rowan-text break-all">
                {secret}
              </div>
            </div>

            {/* Step 3: Verify code */}
            <div className="space-y-3">
              <p className="text-rowan-muted text-sm font-medium">Step 2: Enter 6-digit code</p>
              <OtpInput
                onComplete={(code) => setSetupCode(code)}
                disabled={setupLoading}
                error={!!setupError}
              />
              {setupError && <p className="text-rowan-red text-xs text-center">{setupError}</p>}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowSetup(false);
                  setSetupCode('');
                  setSetupError(null);
                  setSecret(null);
                  setQrCode(null);
                }}
                disabled={setupLoading}
                className="flex-1 py-3 rounded-xl border border-rowan-border text-rowan-text font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifySetup}
                disabled={setupLoading || setupCode.length < 6}
                className="flex-1 py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {setupLoading && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                )}
                Verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === BACKUP CODES DISPLAY (after setup) === */}
      {backupCodes.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div>
              <h2 className="text-rowan-text font-semibold text-lg">Save Your Backup Codes</h2>
              <p className="text-rowan-muted text-sm mt-1">
                Keep these codes safe. You can use them to sign in if you lose access to your authenticator app.
              </p>
            </div>

            <div className="space-y-2 bg-rowan-bg rounded-lg p-4">
              {backupCodes.map((code, idx) => (
                <button
                  key={idx}
                  onClick={() => copyToClipboard(code, idx)}
                  className="w-full flex items-center justify-between p-3 bg-rowan-surface rounded border border-rowan-border hover:bg-rowan-surface/80 transition-colors"
                >
                  <code className="font-mono text-sm text-rowan-text">{code}</code>
                  {copiedIndices.has(idx) ? (
                    <Check size={16} className="text-rowan-green flex-shrink-0" />
                  ) : (
                    <Copy size={16} className="text-rowan-muted flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-lg p-3">
              <p className="text-rowan-red text-xs">
                ⚠️ Write down or save these codes. You won't be able to see them again.
              </p>
            </div>

            <button
              onClick={() => {
                setBackupCodes([]);
                setShowSetup(false);
                setSetupCode('');
              }}
              className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* === DISABLE CONFIRMATION MODAL === */}
      {showDisable && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 space-y-4">
            <div>
              <h2 className="text-rowan-text font-semibold text-lg">Disable 2FA?</h2>
              <p className="text-rowan-muted text-sm mt-2">
                Enter your authentication code to confirm. Your account will be less secure without 2FA.
              </p>
            </div>

            <div className="space-y-3">
              <OtpInput
                onComplete={(code) => setDisableCode(code)}
                disabled={disableLoading}
                error={!!disableError}
              />
              {disableError && <p className="text-rowan-red text-xs text-center">{disableError}</p>}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDisable(false);
                  setDisableCode('');
                  setDisableError(null);
                }}
                disabled={disableLoading}
                className="flex-1 py-3 rounded-xl border border-rowan-border text-rowan-text font-medium text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisable}
                disabled={disableLoading || disableCode.length < 6}
                className="flex-1 py-3 rounded-xl bg-rowan-red text-white font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disableLoading && (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                )}
                Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === REGENERATE BACKUP CODES MODAL === */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            {newBackupCodes.length === 0 ? (
              <>
                <div>
                  <h2 className="text-rowan-text font-semibold text-lg">Regenerate Backup Codes</h2>
                  <p className="text-rowan-muted text-sm mt-2">
                    Enter your authentication code to generate new backup codes. Old codes will be invalidated.
                  </p>
                </div>

                <div className="space-y-3">
                  <OtpInput
                    onComplete={(code) => setRegenerateCode(code)}
                    disabled={regenerateLoading}
                    error={!!regenerateError}
                  />
                  {regenerateError && <p className="text-rowan-red text-xs text-center">{regenerateError}</p>}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRegenerateModal(false);
                      setRegenerateCode('');
                      setRegenerateError(null);
                    }}
                    disabled={regenerateLoading}
                    className="flex-1 py-3 rounded-xl border border-rowan-border text-rowan-text font-medium text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRegenerate}
                    disabled={regenerateLoading || regenerateCode.length < 6}
                    className="flex-1 py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {regenerateLoading && (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                    )}
                    Generate
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-rowan-text font-semibold text-lg">New Backup Codes Generated</h2>
                  <p className="text-rowan-muted text-sm mt-1">
                    Save these new codes. Your old codes are now invalid.
                  </p>
                </div>

                <div className="space-y-2 bg-rowan-bg rounded-lg p-4">
                  {newBackupCodes.map((code, idx) => (
                    <button
                      key={idx}
                      onClick={() => copyToClipboard(code, idx + 100)} // offset index to avoid collision
                      className="w-full flex items-center justify-between p-3 bg-rowan-surface rounded border border-rowan-border hover:bg-rowan-surface/80 transition-colors"
                    >
                      <code className="font-mono text-sm text-rowan-text">{code}</code>
                      {copiedIndices.has(idx + 100) ? (
                        <Check size={16} className="text-rowan-green flex-shrink-0" />
                      ) : (
                        <Copy size={16} className="text-rowan-muted flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setShowRegenerateModal(false);
                    setRegenerateCode('');
                    setNewBackupCodes([]);
                  }}
                  className="w-full py-3 rounded-xl bg-rowan-yellow text-rowan-bg font-medium text-sm"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
