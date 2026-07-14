import { useNavigate } from 'react-router-dom'
import { NETWORKS, STATE_SUBTITLES } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import { isTransactionInProgress } from '../../utils/transactions'
import TransactionStatusBadge from './TransactionStatusBadge'
import Badge from '../ui/Badge'

/**
 * Compact transaction card used in History and Home pages.
 */
export default function TransactionCard({ transaction }) {
  const navigate = useNavigate()
  const network = NETWORKS[transaction.network] || {}
  const inProgress = isTransactionInProgress(transaction)
  const subtitle = STATE_SUBTITLES[transaction.state]
  const cryptoAmount = Number(transaction.usdcAmount ?? transaction.usdc_amount ?? 0)
  const xlmAmount = Number(transaction.xlmAmount ?? transaction.xlm_amount ?? 0)
  const cryptoLabel = cryptoAmount > 0
    ? `${cryptoAmount.toFixed(2)} USDC`
    : xlmAmount > 0
      ? `${xlmAmount.toFixed(2)} XLM`
      : null

  return (
    <button
      onClick={() => navigate(`/wallet/transaction/${transaction.id}`)}
      className={`bg-rowan-surface border rounded-xl p-4 mb-3 w-full text-left min-h-11 ${
        inProgress ? 'border-rowan-yellow/40' : 'border-rowan-border'
      }`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-rowan-muted text-xs">{formatDate(transaction.createdAt)}</p>
          <Badge color={network.color} bg={network.bg} className="mt-1">
            {network.label || transaction.network}
          </Badge>
          {inProgress && subtitle && (
            <p className="text-rowan-muted text-xs mt-2 leading-snug">{subtitle}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {cryptoLabel && (
            <p className="text-rowan-muted text-sm tabular-nums">{cryptoLabel}</p>
          )}
          <p className="text-rowan-text font-bold tabular-nums">
            {transaction.currency || transaction.fiatCurrency}{' '}
            {Number(transaction.fiatAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
          <TransactionStatusBadge state={transaction.state} className="mt-1" />
        </div>
      </div>
    </button>
  )
}
