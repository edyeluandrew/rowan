import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2, XCircle, Shield, RotateCcw, Clock,
} from 'lucide-react'
import PaymentMethodPill from '../ui/PaymentMethodPill'
import { formatCurrency, getTraderDisplayName, formatShortId } from '../../utils/p2pFormat'
import { formatTimeAgo, formatDateTime } from '../../utils/format'
import { isBuyOrder } from '../../utils/transactions'

function StatusIcon({ state, wasDisputed }) {
  if (wasDisputed || state === 'DISPUTE_OPENED') {
    return <Shield size={20} className="text-rowan-yellow" />
  }
  if (state === 'COMPLETE') {
    return <CheckCircle2 size={20} className="text-rowan-green" />
  }
  if (state === 'REFUNDED') {
    return <RotateCcw size={20} className="text-blue-400" />
  }
  if (state === 'FAILED') {
    return <XCircle size={20} className="text-rowan-red" />
  }
  return <Clock size={20} className="text-rowan-muted" />
}

function formatDuration(mins) {
  if (!mins) return null
  return `${mins} min${mins === 1 ? '' : 's'}`
}

export default function P2pHistoryCard({ transaction: tx }) {
  const navigate = useNavigate()
  const currency = tx.currency || tx.fiatCurrency || 'UGX'
  const rate = Number(tx.lockedRate || tx.rate || 0)
  const when = tx.completedAt || tx.createdAt
  const duration = formatDuration(tx.durationMinutes)
  const isBuy = isBuyOrder(tx)
  const fiat = Number(tx.fiatAmount || 0)
  let usdc = Number(tx.usdcAmount ?? tx.usdc_amount ?? 0)
  if (!(usdc > 0) && fiat > 0 && rate > 0) {
    usdc = fiat / rate
  }

  // Buy: +USDC in / −fiat out. Sell: −USDC out / +fiat in.
  const cryptoLine = isBuy
    ? { text: `+${usdc.toFixed(2)} USDC`, tone: 'text-rowan-green' }
    : { text: `−${usdc.toFixed(2)} USDC`, tone: 'text-rowan-red' }
  const fiatLine = isBuy
    ? { text: `−${formatCurrency(fiat, currency)}`, tone: 'text-rowan-red' }
    : { text: `+${formatCurrency(fiat, currency)}`, tone: 'text-rowan-green' }

  const meta = [
    formatShortId(tx.id),
    formatTimeAgo(when),
    duration,
  ].filter(Boolean).join(' · ')

  return (
    <button
      type="button"
      onClick={() => {
        const terminal = ['COMPLETE', 'REFUNDED', 'FAILED'].includes(tx.state)
        navigate(terminal ? `/wallet/history/${tx.id}` : `/wallet/transaction/${tx.id}`)
      }}
      className="w-full bg-rowan-surface border border-rowan-border rounded-xl p-4 text-left min-h-11"
    >
      <div className="flex gap-3">
        <div className="shrink-0 mt-0.5">
          <StatusIcon state={tx.state} wasDisputed={tx.wasDisputed} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-rowan-text text-sm font-medium truncate">
                {isBuy ? 'Bought USDC' : 'Sold USDC'} · {getTraderDisplayName(tx.traderName) || 'Trader'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {tx.network && <PaymentMethodPill network={tx.network} />}
                <span className="text-rowan-muted text-[10px] uppercase tracking-wide">
                  {tx.selectionMethod === 'manual' ? 'Manual pick' : 'Auto-matched'}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-bold tabular-nums ${cryptoLine.tone}`}>
                {cryptoLine.text}
              </p>
              <p className={`text-xs tabular-nums mt-0.5 ${fiatLine.tone}`}>
                {fiatLine.text}
              </p>
            </div>
          </div>
          {rate > 0 && (
            <p className="text-rowan-muted text-xs mt-2">
              @ {formatCurrency(rate, currency)}/USDC
            </p>
          )}
          <p className="text-rowan-muted text-xs mt-1">{meta}</p>
          <p className="text-rowan-muted text-[10px]">{formatDateTime(when)}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {tx.wasDisputed && (
              <span className="text-[10px] font-medium text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                Disputed
              </span>
            )}
            {tx.state === 'COMPLETE' && !tx.reviewSubmitted && (
              <span className="text-[10px] font-medium text-rowan-yellow bg-rowan-yellow/10 px-2 py-0.5 rounded-full">
                Leave review
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
