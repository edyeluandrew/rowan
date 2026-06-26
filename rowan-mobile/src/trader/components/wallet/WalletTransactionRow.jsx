import { Coins, ArrowLeftRight, Copy, CopyCheck, ExternalLink } from 'lucide-react';
import { formatTimeAgo, formatAddress } from '../../utils/format';
import { COPY_FEEDBACK_TIMEOUT_MS, stellarTxExplorerUrl } from '../../utils/constants';
import { useState } from 'react';

/**
 * WalletTransactionRow — single USDC receipt row.
 * Props: transaction { id, stellar_release_tx, usdc_amount, completed_at }
 */
export default function WalletTransactionRow({ transaction }) {
  const tx = transaction;
  const [copied, setCopied] = useState(false);

  const releaseHash = tx.stellar_release_tx || tx.stellarReleaseTx || tx.hash || tx.stellar_tx_hash;
  const explorerUrl = stellarTxExplorerUrl(releaseHash);

  const copyHash = () => {
    if (!releaseHash) return;
    navigator.clipboard.writeText(releaseHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    });
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-rowan-border">
      <div className="w-8 h-8 rounded-full bg-rowan-surface border border-rowan-border flex items-center justify-center flex-shrink-0">
        <Coins size={16} className="text-rowan-green" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <ArrowLeftRight size={12} className="text-rowan-green" />
          <span className="text-rowan-green font-bold tabular-nums text-sm">
            +{Number(tx.amount || tx.usdc_amount || tx.usdcAmount || 0).toFixed(2)} USDC
          </span>
        </div>
        <p className="text-rowan-muted text-xs mt-0.5">
          {formatTimeAgo(tx.completed_at || tx.completedAt || tx.created_at || tx.createdAt)}
        </p>
        {releaseHash && (
          <div className="flex items-center gap-2 mt-0.5">
            <button
              onClick={copyHash}
              className="flex items-center gap-1 text-rowan-muted text-xs font-mono truncate max-w-[160px]"
            >
              {formatAddress(releaseHash)}
              {copied ? (
                <CopyCheck size={12} className="text-rowan-green" />
              ) : (
                <Copy size={12} className="text-rowan-yellow" />
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
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
