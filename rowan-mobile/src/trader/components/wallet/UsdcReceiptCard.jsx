import { CheckCircle2, Copy, CopyCheck, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { formatAddress } from '../../utils/format';
import { COPY_FEEDBACK_TIMEOUT_MS, stellarTxExplorerUrl } from '../../utils/constants';

/**
 * UsdcReceiptCard — shows USDC release details after a trade completes.
 */
export default function UsdcReceiptCard({ tx, onViewWallet }) {
  const [copiedField, setCopiedField] = useState(null);

  const usdcAmount = Number(tx.usdc_amount || tx.usdcAmount || 0);
  const stellarAddress = tx.stellar_address || tx.stellarAddress || '';
  const releaseHash = tx.stellar_release_tx || tx.stellarReleaseTx || '';
  const explorerUrl = stellarTxExplorerUrl(releaseHash);

  const copy = (value, field) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), COPY_FEEDBACK_TIMEOUT_MS);
    });
  };

  return (
    <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4 mb-4">
      <div className="text-center mb-3">
        <CheckCircle2 size={36} className="text-rowan-green block mx-auto mb-2" />
        <p className="text-rowan-green text-sm font-medium">Transaction Complete</p>
        <p className="text-rowan-text text-lg font-bold tabular-nums mt-1">
          +{usdcAmount.toFixed(2)} USDC received
        </p>
      </div>

      {stellarAddress && (
        <div className="bg-rowan-bg/50 rounded-lg p-3 mb-2">
          <p className="text-rowan-muted text-[10px] uppercase tracking-wider mb-1">Sent to your address</p>
          <div className="flex items-start justify-between gap-2">
            <p className="text-rowan-text text-xs font-mono break-all flex-1">{stellarAddress}</p>
            <button
              onClick={() => copy(stellarAddress, 'address')}
              className="text-rowan-yellow shrink-0"
              aria-label="Copy Stellar address"
            >
              {copiedField === 'address' ? (
                <CopyCheck size={14} className="text-rowan-green" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
        </div>
      )}

      {releaseHash && (
        <div className="bg-rowan-bg/50 rounded-lg p-3">
          <p className="text-rowan-muted text-[10px] uppercase tracking-wider mb-1">Stellar payment proof</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-rowan-muted text-xs font-mono truncate flex-1">{formatAddress(releaseHash)}</p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copy(releaseHash, 'hash')}
                className="text-rowan-yellow"
                aria-label="Copy transaction hash"
              >
                {copiedField === 'hash' ? (
                  <CopyCheck size={14} className="text-rowan-green" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rowan-yellow"
                  aria-label="View on Stellar explorer"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {onViewWallet && (
        <button
          onClick={onViewWallet}
          className="w-full mt-3 py-2.5 border border-rowan-green/40 text-rowan-green text-sm rounded-lg"
        >
          View Stellar Wallet
        </button>
      )}
    </div>
  );
}
