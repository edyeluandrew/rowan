import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * QrDisplay — Shared QR code + manual key display
 * Used during 2FA setup for both trader and wallet users
 * 
 * Props:
 * - qrCode: string (data URL)
 * - manualEntry: string (TOTP secret)
 * - onCopy?: () => void (callback after copy)
 */
export default function QrDisplay({ qrCode, manualEntry, onCopy }) {
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(manualEntry);
      setCopiedKey(true);
      onCopy?.();
      setTimeout(() => setCopiedKey(false), 2000);
    } catch (err) {
      console.error('Failed to copy key:', err);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* QR Code */}
      <div className="flex justify-center">
        {qrCode ? (
          <img
            src={qrCode}
            alt="2FA Setup QR Code"
            className="w-48 h-48 rounded-xl border border-rowan-border bg-white p-2"
          />
        ) : (
          <div className="w-48 h-48 rounded-xl border border-rowan-border bg-rowan-surface animate-pulse" />
        )}
      </div>

      {/* Manual Entry */}
      <div className="bg-rowan-surface rounded-xl p-4 space-y-3">
        <p className="text-rowan-muted text-xs uppercase tracking-wider">Can't scan? Enter code manually:</p>
        <div className="flex items-center justify-between gap-3">
          <code className="text-rowan-text text-sm font-mono flex-1 break-all bg-rowan-bg p-2 rounded px-3">
            {manualEntry}
          </code>
          <button
            onClick={handleCopyKey}
            className="shrink-0 p-2 text-rowan-yellow hover:bg-rowan-yellow/10 rounded-lg transition-colors min-h-10 min-w-10 flex items-center justify-center"
          >
            {copiedKey ? (
              <Check size={20} className="text-rowan-green" />
            ) : (
              <Copy size={20} />
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 text-rowan-text text-xs rounded-xl p-3 space-y-2">
        <p className="font-semibold">Save your setup key</p>
        <p className="text-rowan-muted">If you lose your authenticator app, you'll need this key to restore access along with your backup codes.</p>
      </div>
    </div>
  );
}
