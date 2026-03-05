import { Coins, ArrowLeftRight, Copy, CopyCheck } from 'lucide-react';
import { formatTimeAgo, formatAddress } from '../../utils/format';
import { useState } from 'react';

/**
 * WalletTransactionRow — single USDC receipt row.
 * Props: transaction { id, hash, amount, created_at }
 */
export default function WalletTransactionRow({ transaction }) {
  const tx = transaction;
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    if (!tx.hash && !tx.stellar_tx_hash) return;
    navigator.clipboard.writeText(tx.hash || tx.stellar_tx_hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS);
    });
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-rowan-border">
      {/* Icon */}
      <div className="w-8 h-8 rounded-full bg-rowan-surface border border-rowan-border flex items-center justify-center flex-shrink-0">
        <Coins size={16} className="text-rowan-green" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <ArrowLeftRight size={12} className="text-rowan-green" />
          <span className="text-rowan-green font-bold tabular-nums text-sm">
            +{Number(tx.amount || tx.usdc_amount || 0).toFixed(2)} USDC
          </span>
        </div>
        <p className="text-rowan-muted text-xs mt-0.5">
          {formatTimeAgo(tx.created_at || tx.createdAt)}
        </p>
        <button onClick={copyHash} className="flex items-center gap-1 text-rowan-muted text-xs font-mono truncate max-w-[180px] mt-0.5">
          {formatAddress(tx.hash || tx.stellar_tx_hash || '')}
          {copied ? (
            <CopyCheck size={12} className="text-rowan-green" />
          ) : (
            <Copy size={12} className="text-rowan-yellow" />
          )}
        </button>
      </div>
    </div>
  );
}
