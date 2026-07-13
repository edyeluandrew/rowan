import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';
import { formatCurrency, formatDateTime, formatTimeAgo, formatAddress } from '../../utils/format';

/**
 * Trader ledger signs:
 * - Sell (customer cash-out): trader pays fiat (−) and receives USDC (+)
 * - Buy (customer buys USDC): trader receives fiat (+) and sends USDC (−)
 */
function signedLines(item) {
  const isBuy = String(item.order_side || item.orderSide || 'SELL').toUpperCase() === 'BUY';
  const fiat = Number(item.fiat_amount || 0);
  const usdc = Number(item.usdc_amount || 0);
  const currency = item.fiat_currency || 'UGX';

  if (isBuy) {
    return {
      sideLabel: 'You sold USDC',
      primary: {
        sign: '+',
        amount: formatCurrency(fiat, currency),
        tone: 'text-rowan-green',
        hint: 'MoMo in',
      },
      secondary: {
        sign: '−',
        amount: `${usdc.toFixed(2)} USDC`,
        tone: 'text-rowan-red',
        hint: 'USDC out',
      },
    };
  }

  return {
    sideLabel: 'You paid MoMo',
    primary: {
      sign: '−',
      amount: formatCurrency(fiat, currency),
      tone: 'text-rowan-red',
      hint: 'MoMo out',
    },
    secondary: {
      sign: '+',
      amount: `${usdc.toFixed(2)} USDC`,
      tone: 'text-rowan-green',
      hint: 'USDC in',
    },
  };
}

export default function TransactionCard({ tx, transaction }) {
  const item = tx || transaction;
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (!item) return null;

  const created = item.created_at || item.createdAt;
  const completed = item.completed_at || item.completedAt;
  const when = completed || created;
  const lines = signedLines(item);

  return (
    <div
      className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-2 select-none"
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-rowan-text text-xs font-medium">{lines.sideLabel}</p>
          <p className="text-rowan-muted text-[11px] mt-0.5">
            {formatTimeAgo(when)}
            <span className="text-rowan-muted/70"> · {formatDateTime(when)}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge type="network" value={item.network} />
            <Badge type="status" value={item.state} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold tabular-nums ${lines.primary.tone}`}>
            {lines.primary.sign}{lines.primary.amount}
          </p>
          <p className="text-rowan-muted text-[10px]">{lines.primary.hint}</p>
          <p className={`text-xs font-semibold tabular-nums mt-1 ${lines.secondary.tone}`}>
            {lines.secondary.sign}{lines.secondary.amount}
          </p>
          <p className="text-rowan-muted text-[10px]">{lines.secondary.hint}</p>
        </div>
      </div>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: expanded ? '220px' : '0px' }}
      >
        <div className="mt-3 pt-3 border-t border-rowan-border space-y-2">
          {(item.stellar_release_tx || item.stellar_tx_hash) && (
            <div className="flex items-center gap-2">
              <span className="text-rowan-muted text-xs">Stellar TX:</span>
              <span className="text-rowan-green text-xs font-mono truncate flex-1">
                {formatAddress(item.stellar_release_tx || item.stellar_tx_hash)}
              </span>
              <button
                type="button"
                className="text-rowan-green text-xs"
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
          {item.id && (
            <button
              type="button"
              className="text-rowan-green text-xs font-medium min-h-9"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/trader/requests/${item.id}`);
              }}
            >
              Open request →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
