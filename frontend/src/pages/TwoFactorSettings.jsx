import { useState, useEffect } from 'react';
import { AlertCircle, Copy, Check } from 'lucide-react';
import {
  initiate2faSetup,
  verifyTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
} from '../api/twoFactor';
import Button from '../components/ui/Button';
import OtpInput from '../components/ui/OtpInput';
import Modal from '../components/ui/Modal';

/**
 * TwoFactorSettings — Enable/disable 2FA in account settings
 */
export default function TwoFactorSettings({ currentTwoFactorEnabled = false, onRefresh }) {
  const [enabled, setEnabled] = useState(currentTwoFactorEnabled);
  const [loading, setLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);

  // Setup flow
  const [secret, setSecret] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  // Disable flow
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Copy to clipboard
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleEnableClick = async () => {
    setSetupLoading(true);
    try {
      const data = await initiate2faSetup();
      setSecret(data.secret);
      setQrCode(data.qrCode);
      setShowSetupModal(true);
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
      setBackupCodes(data.backupCodes);
      setEnabled(true);
      setShowSetupModal(false);
      onRefresh?.();
    } catch (err) {
      setSetupError(err.response?.data?.error || 'Verification failed');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisableClick = () => {
    setShowDisableModal(true);
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
      setEnabled(false);
      setShowDisableModal(false);
      onRefresh?.();
    } catch (err) {
      setDisableError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  const copyToClipboard = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Status Card */}
      <div className="bg-rowan-card border border-rowan-border rounded-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-rowan-text font-semibold text-base md:text-lg">Two-Factor Authentication</h3>
            <p className="text-rowan-muted text-xs md:text-sm mt-2">
              {enabled
                ? 'Enabled - Your account is protected with 2FA'
                : 'Disabled - Add an extra layer of security to your account'}
            </p>
          </div>
          <div
            className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
              enabled ? 'bg-rowan-green' : 'bg-rowan-dark-bg'
            }`}
          />
        </div>
      </div>

      {/* Action Button */}
      <Button
        variant={enabled ? 'danger' : 'primary'}
        onClick={enabled ? handleDisableClick : handleEnableClick}
        loading={setupLoading}
        className="w-full md:w-auto"
      >
        {enabled ? 'Disable 2FA' : 'Enable 2FA'}
      </Button>

      {/* Information */}
      <div className="bg-rowan-dark-bg border border-rowan-border rounded-lg p-3 md:p-4 space-y-3">
        <div className="flex gap-2 md:gap-3">
          <AlertCircle size={16} className="text-rowan-yellow flex-shrink-0 mt-0.5 md:mt-1" />
          <div className="text-xs md:text-sm text-rowan-muted space-y-2 min-w-0">
            <p>
              <strong>What is 2FA?</strong> Two-Factor Authentication adds an extra security step
              by requiring a code from your authenticator app when signing in.
            </p>
            <p>
              <strong>Supported apps:</strong> Google Authenticator, Microsoft Authenticator,
              Authy, etc.
            </p>
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      {showSetupModal && !backupCodes.length && (
        <Modal
          title="Enable Two-Factor Authentication"
          onClose={() => setShowSetupModal(false)}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowSetupModal(false)}
                disabled={setupLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleVerifySetup}
                loading={setupLoading}
              >
                Verify
              </Button>
            </>
          }
        >
          <div className="space-y-4 md:space-y-6">
            <div>
              <p className="text-rowan-muted text-xs md:text-sm mb-3 md:mb-4">
                1. Scan this QR code with your authenticator app:
              </p>
              {qrCode && (
                <div className="bg-white p-3 md:p-4 rounded-lg w-fit mx-auto">
                  <img src={qrCode} alt="QR Code" className="w-40 h-40 md:w-48 md:h-48" />
                </div>
              )}
            </div>

            <div>
              <p className="text-rowan-muted text-xs md:text-sm mb-2">
                Or enter this key manually:
              </p>
              <div className="bg-rowan-dark-bg border border-rowan-border rounded p-2 md:p-3 font-mono text-xs md:text-sm text-rowan-text break-all">
                {secret}
              </div>
            </div>

            <div>
              <label className="block text-rowan-muted text-xs md:text-sm mb-3">
                2. Enter the 6-digit code from your app:
              </label>
              <OtpInput
                onComplete={(val) => setSetupCode(val)}
                error={!!setupError}
              />
              {setupError && <p className="text-rowan-red text-xs md:text-sm mt-2">{setupError}</p>}
            </div>
          </div>
        </Modal>
      )}

      {/* Backup Codes Display */}
      {backupCodes.length > 0 && (
        <Modal
          title="Save Your Backup Codes"
          onClose={() => {
            setShowSetupModal(false);
            setBackupCodes([]);
          }}
          actions={
            <Button
              variant="primary"
              onClick={() => {
                setShowSetupModal(false);
                setBackupCodes([]);
              }}
              className="w-full"
            >
              Done
            </Button>
          }
        >
          <div className="space-y-3 md:space-y-4">
            <div className="bg-rowan-yellow/10 border border-rowan-yellow rounded-lg p-3 md:p-4">
              <p className="text-rowan-yellow text-xs md:text-sm font-semibold mb-2">⚠️ Important</p>
              <p className="text-rowan-muted text-xs md:text-sm">
                Save these backup codes in a safe place. You can use them to sign in if you lose
                access to your authenticator app.
              </p>
            </div>

            {/* Responsive Grid for Backup Codes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {backupCodes.map((code, idx) => (
                <div
                  key={idx}
                  className="bg-rowan-dark-bg border border-rowan-border rounded p-2 md:p-3 flex items-center justify-between gap-2"
                >
                  <code className="font-mono text-xs md:text-sm text-rowan-text break-all">{code}</code>
                  <button
                    onClick={() => copyToClipboard(code, idx)}
                    className="text-rowan-yellow hover:text-rowan-yellow/80 transition-colors flex-shrink-0"
                  >
                    {copiedIndex === idx ? <Check size={16} className="md:size-18" /> : <Copy size={16} className="md:size-18" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Disable Confirmation Modal */}
      {showDisableModal && (
        <Modal
          title="Disable Two-Factor Authentication"
          onClose={() => setShowDisableModal(false)}
          actions={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowDisableModal(false)}
                disabled={disableLoading}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmDisable}
                loading={disableLoading}
                className="w-full sm:w-auto"
              >
                Disable
              </Button>
            </>
          }
        >
          <div className="space-y-3 md:space-y-4">
            <p className="text-rowan-muted text-xs md:text-sm">
              To disable 2FA, please enter the 6-digit code from your authenticator app:
            </p>
            <OtpInput
              onComplete={(val) => setDisableCode(val)}
              error={!!disableError}
            />
            {disableError && <p className="text-rowan-red text-xs md:text-sm">{disableError}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
