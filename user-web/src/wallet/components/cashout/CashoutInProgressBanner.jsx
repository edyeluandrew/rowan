import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { STATE_SUBTITLES } from '../../utils/constants'
import { formatFiatAmount } from '../../utils/fiat'
import { getSellProgressSubtitle } from '../../utils/p2pFormat'
import { isBuyOrder } from '../../utils/transactions'

/**
 * Home banner for an active P2P buy or sell — deep-links back into the open order.
 */
export default function CashoutInProgressBanner({ transaction }) {
  const navigate = useNavigate()
  if (!transaction?.id) return null

  const isBuy = isBuyOrder(transaction)
  const title = isBuy ? 'Buy in progress' : 'Sell in progress'
  const sellSubtitle = !isBuy ? getSellProgressSubtitle(transaction) : null
  let subtitle = sellSubtitle
    || STATE_SUBTITLES[transaction.state]
    || (isBuy ? 'Trade in progress' : 'Cash out in progress')
  if (transaction.state === 'TRADER_MATCHED' && !sellSubtitle) {
    subtitle = transaction.matchedAt || transaction.traderMatchedAt
      ? (isBuy ? 'Trader ready — complete your MoMo payment' : 'Trader accepted — waiting for mobile money')
      : 'A trader is reviewing your request'
  }
  const hasFiat = Number.isFinite(Number(transaction.fiatAmount))
  const fiatLabel = hasFiat
    ? formatFiatAmount(
      transaction.fiatAmount,
      transaction.fiatCurrency || transaction.currency || 'UGX',
    )
    : null

  return (
    <button
      type="button"
      onClick={() => navigate(`/wallet/transaction/${transaction.id}`)}
      className="w-full mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 text-left min-h-11"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Clock size={18} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-rowan-text text-sm font-medium">{title}</p>
            {fiatLabel && (
              <p className="text-rowan-yellow text-sm font-semibold tabular-nums mt-0.5">
                {fiatLabel}
              </p>
            )}
            <p className="text-rowan-muted text-xs mt-1 truncate">{subtitle}</p>
            <p className="text-rowan-muted text-xs mt-1">
              Tap to resume · finish this trade before starting another
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-rowan-muted shrink-0 mt-1" />
      </div>
    </button>
  )
}
