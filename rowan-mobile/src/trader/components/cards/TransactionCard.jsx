import { useState } from 'react';
import Badge from '../ui/Badge';
import { formatCurrency, formatDateTime, formatAddress } from '../../utils/format';

export default function TransactionCard({ tx, transaction }) {
  const item = tx || transaction;
  const [expanded, setExpanded] = useState(false);

  if (!item) return null;

  return (
    <div
      className="bg-rowan-surface border border-rowan-border rounded-md p-4 mb-2 select-none"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="text-rowan-muted text-xs">{formatDateTime(item.created_at)}</div>
          <div className="mt-1">
            <Badge type="network" value={item.network} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-rowan-text font-bold tabular-nums">
            {formatCurrency(item.fiat_amount, item.fiat_currency)}
          </div>
          <div className="text-rowan-muted text-xs tabular-nums">
            {formatCurrency(item.usdc_amount, 'USDC')}
          </div>
        </div>
        <Badge type="status" value={item.state} />
      </div>

      {/* Expanded details */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? '200px' : '0px' }}
      >
        <div className="mt-3 pt-3 border-t border-rowan-border space-y-2">
          {(item.stellar_release_tx || item.stellar_tx_hash) && (
            <div className="flex items-center gap-2">
              <span className="text-rowan-muted text-xs">Stellar TX:</span>
              <span className="text-rowan-yellow text-xs font-mono truncate flex-1">
                {formatAddress(item.stellar_release_tx || item.stellar_tx_hash)}
              </span>
              <button
                className="text-rowan-yellow text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(item.stellar_release_tx || item.stellar_tx_hash);
                }}
              >
                Copy
              </button>
            </div>
          )}
          {item.recipient_phone_last4 && (
            <div className="flex items-center gap-2">
              <span className="text-rowan-muted text-xs">Recipient:</span>
              <span className="text-rowan-text text-xs font-mono">*** {item.recipient_phone_last4}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-rowan-muted text-xs">Ref:</span>
            <span className="text-rowan-muted text-xs font-mono">{item.reference || item.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
