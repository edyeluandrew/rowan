import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * BackupCodesDisplay — Shared backup codes display + copy functionality
 * Used after 2FA setup to show codes (shown once, suggested to save)
 * 
 * Props:
 * - codes: string[]
 * - title?: string
 * - description?: string
 */
export default function BackupCodesDisplay({
  codes,
  title = 'Save Your Backup Codes',
  description = 'Save these codes in a secure location. Each code can be used once if you lose access to your authenticator.',
}) {
  const [copiedIndices, setCopiedIndices] = useState(new Set());

  const copyCode = async (code, index) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndices((prev) => new Set([...prev, index]));
      setTimeout(() => {
        setCopiedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const copyAll = async () => {
    try {
      const allCodes = codes.join('\n');
      await navigator.clipboard.writeText(allCodes);
      setCopiedIndices(new Set(codes.map((_, i) => i)));
      setTimeout(() => setCopiedIndices(new Set()), 2000);
    } catch (err) {
      console.error('Failed to copy codes:', err);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div>
        <h3 className="text-rowan-text text-lg font-semibold mb-2">{title}</h3>
        <p className="text-rowan-muted text-sm">{description}</p>
      </div>

      {/* Codes Grid */}
      <div className="bg-rowan-surface rounded-xl divide-y divide-rowan-border overflow-hidden">
        {codes.map((code, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-3 hover:bg-rowan-bg/50 transition-colors"
          >
            <code className="font-mono text-sm text-rowan-text tracking-wider">
              {code}
            </code>
            <button
              onClick={() => copyCode(code, index)}
              className="ml-3 shrink-0 p-2 text-rowan-yellow hover:bg-rowan-yellow/10 rounded-lg transition-colors min-h-10 min-w-10 flex items-center justify-center"
              title="Copy code"
            >
              {copiedIndices.has(index) ? (
                <Check size={18} className="text-rowan-green" />
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Copy All Button */}
      <button
        onClick={copyAll}
        className="w-full py-2 px-4 rounded-xl border border-rowan-yellow text-rowan-yellow text-sm font-medium transition-colors hover:bg-rowan-yellow/10 min-h-10"
      >
        Copy All Codes
      </button>

      {/* Warning */}
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 text-rowan-text text-xs rounded-xl p-3 space-y-2">
        <p className="font-semibold">⚠️ Important</p>
        <ul className="list-disc list-inside space-y-1 text-rowan-muted">
          <li>This is the only time these codes will be displayed</li>
          <li>Store them in a secure location (password manager, safe)</li>
          <li>Do not share these codes with anyone</li>
          <li>Each code can only be used once</li>
        </ul>
      </div>
    </div>
  );
}
