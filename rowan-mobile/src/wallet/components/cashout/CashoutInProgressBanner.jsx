import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { STATE_SUBTITLES } from '../../utils/constants'
import { formatFiatAmount } from '../../utils/fiat'

/**
 * Home banner for an active cash-out (funds in escrow / MoMo pending).
 */
export default function CashoutInProgressBanner({ transaction }) {
  const navigate = useNavigate()
  if (!transaction) return null

  let subtitle = STATE_SUBTITLES[transaction.state] || 'Cash out in progress'
  if (transaction.state === 'TRADER_MATCHED') {
    subtitle = transaction.matchedAt
      ? 'Trader accepted — waiting for mobile money'
      : 'A trader is reviewing your request'
  }
  const fiatLabel = formatFiatAmount(
    transaction.fiatAmount,
    transaction.fiatCurrency || transaction.currency || 'UGX',
  )

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
            <p className="text-rowan-text text-sm font-medium">Cash out in progress</p>
            <p className="text-rowan-yellow text-sm font-semibold tabular-nums mt-0.5">
              {fiatLabel}
            </p>
            <p className="text-rowan-muted text-xs mt-1 truncate">{subtitle}</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-rowan-muted shrink-0 mt-1" />
      </div>
    </button>
  )
}
