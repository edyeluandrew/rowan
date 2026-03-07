import { useNavigate } from 'react-router-dom'
import { NETWORKS } from '../../utils/constants'
import { formatDate } from '../../utils/format'
import TransactionStatusBadge from './TransactionStatusBadge'
import Badge from '../ui/Badge'

/**
 * Compact transaction card used in History and Home pages.
 */
export default function TransactionCard({ transaction }) {
  const navigate = useNavigate()
  const network = NETWORKS[transaction.network] || {}

  return (
    <button
      onClick={() => navigate(`/wallet/history/${transaction.id}`)}
      className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-3 w-full text-left min-h-11"
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-rowan-muted text-xs">{formatDate(transaction.createdAt)}</p>
          <Badge color={network.color} bg={network.bg} className="mt-1">
            {network.label || transaction.network}
          </Badge>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-rowan-muted text-sm tabular-nums">
            {Number(transaction.xlmAmount || 0).toFixed(2)} XLM
          </p>
          <p className="text-rowan-text font-bold tabular-nums">
            {transaction.currency}{' '}
            {Number(transaction.fiatAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
          <TransactionStatusBadge state={transaction.state} className="mt-1" />
        </div>
      </div>
    </button>
  )
}
