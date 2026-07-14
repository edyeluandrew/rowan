import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { 
  check2faStatus,
  initiate2faSetup,
  verifyTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
} from '../../api/twoFactor';
import TwoFactorSetupModal from '../../../shared/components/twofactor/TwoFactorSetupModal';
import TwoFactorDisableModal from '../../../shared/components/twofactor/TwoFactorDisableModal';
import TwoFactorRegenerateModal from '../../../shared/components/twofactor/TwoFactorRegenerateModal';
import LoadingSpinner from "../../components/ui/LoadingSpinner";

/**
 * TwoFactorSettings — Wallet user 2FA management page
 * Enable/disable 2FA, regenerate backup codes
 */
export default function TwoFactorSettings() {
  const navigate = useNavigate();

  // Status check
  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);

  // Setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Disable modal
  const [showDisableModal, setShowDisableModal] = useState(false);

  // Regenerate modal
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerateStep, setRegenerateStep] = useState('verify'); // 'verify' | 'codes'
  const [newBackupCodes, setNewBackupCodes] = useState([]);

  // Load status on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await check2faStatus();
        setStatus(data);
      } catch (err) {
        setStatusError(err.message || 'Failed to load 2FA status');
        setStatus({ isEnabled: false, backupCodesRemaining: 0 });
      } finally {
        setStatusLoading(false);
      }
    })();
  }, []);

  // === SETUP HANDLERS ===
  const handleSetupInitiate = async () => {
    return await initiate2faSetup();
  };

  const handleSetupVerify = async (code) => {
    const data = await verifyTwoFactorSetup(code);
    setStatus({ isEnabled: true, backupCodesRemaining: 10 });
    return data;
  };

  // === DISABLE HANDLERS ===
  const handleDisable = async (code) => {
    await disableTwoFactor(code);
    setStatus({ isEnabled: false, backupCodesRemaining: 0 });
    setShowDisableModal(false);
  };

  // === REGENERATE HANDLERS ===
  const handleRegenerateInitiate = async (code) => {
    const data = await regenerateBackupCodes(code);
    setNewBackupCodes(data.backupCodes || []);
    setRegenerateStep('codes');
    return data;
  };

  if (statusLoading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border sticky top-0 bg-rowan-bg/95 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="text-rowan-text p-2 min-h-10 min-w-10 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text font-semibold text-lg">Two-Factor Authentication</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-6">
        {/* Status Card */}
        <div
          className={`rounded-xl p-4 border ${
            status?.isEnabled
              ? 'bg-rowan-green/10 border-rowan-green/30'
              : 'bg-rowan-yellow/10 border-rowan-yellow/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={20}
              className={`shrink-0 mt-0.5 ${
                status?.isEnabled ? 'text-rowan-green' : 'text-rowan-yellow'
              }`}
            />
            <div>
              <p className={`text-sm font-semibold ${
                status?.isEnabled ? 'text-rowan-green' : 'text-rowan-yellow'
              }`}>
                {status?.isEnabled ? '2FA Enabled' : '2FA Disabled'}
              </p>
              <p className="text-rowan-muted text-xs mt-1">
                {status?.isEnabled
                  ? 'Your account is protected with two-factor authentication.'
                  : 'Enable 2FA to add an extra layer of security to your account.'}
              </p>
              {status?.isEnabled && status?.backupCodesRemaining !== undefined && (
                <p className="text-rowan-muted text-xs mt-2">
                  <strong>{status.backupCodesRemaining}</strong> backup code{status.backupCodesRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {statusError && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red text-sm rounded-lg p-3">
            {statusError}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {!status?.isEnabled ? (
            <>
              <button
                onClick={() => setShowSetupModal(true)}
                className="w-full py-3 px-4 rounded-xl bg-rowan-yellow text-rowan-bg font-bold text-sm transition-opacity active:opacity-80 min-h-11"
              >
                Enable 2FA
              </button>
              <p className="text-rowan-muted text-xs text-center">
                You'll need an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator.
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setRegenerateStep('verify');
                  setShowRegenerateModal(true);
                }}
                className="w-full py-3 px-4 rounded-xl border border-rowan-yellow text-rowan-yellow font-medium text-sm transition-colors active:bg-rowan-yellow/10 flex items-center justify-center gap-2 min-h-11"
              >
                <RefreshCw size={16} />
                Regenerate Backup Codes
              </button>
              <button
                onClick={() => setShowDisableModal(true)}
                className="w-full py-3 px-4 rounded-xl border border-rowan-red text-rowan-red font-medium text-sm transition-colors active:bg-rowan-red/10 min-h-11"
              >
                Disable 2FA
              </button>
            </>
          )}
        </div>

        {/* Information Section */}
        <div className="bg-rowan-surface rounded-xl p-4 space-y-4">
          <h3 className="text-rowan-text font-semibold text-sm">
            {status?.isEnabled ? 'How 2FA Works' : 'About 2FA'}
          </h3>
          <ul className="space-y-3 text-rowan-muted text-xs">
            <li className="flex gap-2">
              <span className="shrink-0 text-rowan-yellow">•</span>
              <span>
                Two-factor authentication requires both your password and a code from your authenticator app to sign in.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-rowan-yellow">•</span>
              <span>
                Keep your backup codes in a safe place. You can use them to sign in if you lose access to your authenticator app.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-rowan-yellow">•</span>
              <span>
                Each backup code can only be used once.
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Modals */}
      <TwoFactorSetupModal
        isVisible={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onSetupInitiate={handleSetupInitiate}
        onSetupVerify={handleSetupVerify}
        onSetupSuccess={() => setShowSetupModal(false)}
      />

      <TwoFactorDisableModal
        isVisible={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        onDisable={handleDisable}
        onDisableSuccess={() => {
          setShowDisableModal(false);
          setStatus({ isEnabled: false, backupCodesRemaining: 0 });
        }}
      />

      <TwoFactorRegenerateModal
        isVisible={showRegenerateModal}
        onClose={() => {
          setShowRegenerateModal(false);
          setRegenerateStep('verify');
          setNewBackupCodes([]);
        }}
        onRegenerate={handleRegenerateInitiate}
        step={regenerateStep}
        newCodes={newBackupCodes}
        onRegenerateSuccess={() => {
          setShowRegenerateModal(false);
          setRegenerateStep('verify');
          setStatus({ ...status, backupCodesRemaining: 10 });
        }}
      />
    </div>
  );
}
