import { useState } from 'react';
import Badge from '../ui/Badge';
import { formatCurrency, formatDateTime, formatAddress } from '../../utils/format';

export default function TransactionCard({ tx }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-rowan-surface border border-rowan-border rounded-md p-4 mb-2 select-none"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-rowan-muted text-xs">{formatDateTime(tx.created_at)}</div>
          <div className="mt-1">
            <Badge type="network" value={tx.network} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-rowan-text font-bold tabular-nums">
            {formatCurrency(tx.fiat_amount, tx.fiat_currency)}
          </div>
          <div className="text-rowan-muted text-xs tabular-nums">
            {formatCurrency(tx.usdc_amount, 'USDC')}
          </div>
        </div>
        <Badge type="status" value={tx.state} />
      </div>

      {/* Expanded details */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? '200px' : '0px' }}
      >
        <div className="mt-3 pt-3 border-t border-rowan-border space-y-2">
          {tx.stellar_tx_hash && (
            <div className="flex items-center gap-2">
              <span className="text-rowan-muted text-xs">Stellar TX:</span>
              <span className="text-rowan-yellow text-xs font-mono truncate flex-1">
                {formatAddress(tx.stellar_tx_hash)}
              </span>
              <button
                className="text-rowan-yellow text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(tx.stellar_tx_hash);
                }}
              >
                Copy
              </button>
            </div>
          )}
          {tx.recipient_phone_last4 && (
            <div className="flex items-center gap-2">
              <span className="text-rowan-muted text-xs">Recipient:</span>
              <span className="text-rowan-text text-xs font-mono">*** {tx.recipient_phone_last4}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-rowan-muted text-xs">Ref:</span>
            <span className="text-rowan-muted text-xs font-mono">{tx.reference || tx.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
