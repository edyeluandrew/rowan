import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, Signal, Wifi } from 'lucide-react'
import PaymentMethodPill from '../ui/PaymentMethodPill'
import { formatCurrency } from '../../utils/p2pFormat'
import { formatTimeAgo, formatDateTime } from '../../utils/format'
import { maskPhoneNumber } from '../../utils/crypto'

function StatusIcon({ state }) {
  if (state === 'COMPLETED') {
    return <CheckCircle2 size={20} className="text-rowan-green" />
  }
  if (state === 'FAILED' || state === 'EXPIRED') {
    return <XCircle size={20} className="text-rowan-red" />
  }
  return <Clock size={20} className="text-rowan-muted" />
}

function TypeIcon({ utilityType }) {
  if (utilityType === 'data') {
    return <Wifi size={20} className="text-rowan-gold" />
  }
  return <Signal size={20} className="text-rowan-gold" />
}

export default function UtilityHistoryCard({ transaction: tx }) {
  const navigate = useNavigate()
  const currency = tx.currency || tx.fiatCurrency || 'UGX'
  const when = tx.completedAt || tx.completed_at || tx.createdAt || tx.created_at
  const usdc = Number(tx.usdcAmount ?? tx.usdc_amount ?? 0)
  const fiat = Number(tx.fiatAmount ?? tx.fiat_amount ?? 0)
  const label = tx.utilityLabel || tx.utility_label
    || (tx.utilityType === 'data' || tx.utility_type === 'data' ? 'Data bundle' : 'Airtime')

  return (
    <button
      type="button"
      onClick={() => navigate(`/wallet/utilities/status/${tx.id}`, { state: { quote: tx } })}
      className="w-full bg-rowan-surface border border-rowan-border rounded-xl p-4 text-left min-h-11"
    >
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5 flex flex-col gap-1">
          <StatusIcon state={tx.state} />
          <TypeIcon utilityType={tx.utilityType || tx.utility_type} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-rowan-text text-sm font-medium truncate">{label}</p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {tx.network && <PaymentMethodPill network={tx.network} />}
                {(tx.recipientPhone || tx.recipient_phone) && (
                  <span className="text-rowan-muted text-[10px]">
                    {maskPhoneNumber(tx.recipientPhone || tx.recipient_phone)}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-rowan-red text-sm font-bold tabular-nums">
                −{usdc.toFixed(2)} USDC
              </p>
              <p className="text-rowan-muted text-xs tabular-nums mt-0.5">
                {formatCurrency(fiat, currency)}
              </p>
            </div>
          </div>
          <p className="text-rowan-muted text-xs mt-2">
            {(tx.shortId || tx.short_id || tx.id?.slice(0, 8))} · {formatTimeAgo(when)}
          </p>
          <p className="text-rowan-muted text-[10px]">{formatDateTime(when)}</p>
        </div>
      </div>
    </button>
  )
}
