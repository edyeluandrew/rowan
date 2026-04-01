import { useNavigate } from 'react-router-dom'
import { TRANSACTION_STATES } from '../../../shared/utils/constants'
import { formatUsdc, formatTimeAgo, formatAddress } from '../../../shared/utils/format'
import Badge from '../../../shared/components/ui/Badge'

export default function RecentTransactions({ transactions = [], loading = false }) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
        <h3 className="text-rowan-text font-bold mb-4">Recent Transactions</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-rowan-border/30 rounded mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <h3 className="text-rowan-text font-bold mb-4">Recent Transactions</h3>
      {transactions.length === 0 ? (
        <p className="text-rowan-muted text-sm text-center py-6">No recent transactions</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const state = TRANSACTION_STATES[tx.state] || TRANSACTION_STATES.pending_trader
            return (
              <button
                key={tx.id}
                onClick={() => navigate(`/transactions/${tx.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-rowan-bg/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-rowan-text text-sm truncate">{tx.trader_name || formatAddress(tx.id)}</p>
                  <p className="text-rowan-muted text-xs">{formatTimeAgo(tx.created_at)}</p>
                </div>
                <p className="text-rowan-text text-sm font-medium">{formatUsdc(tx.usdc_amount)} USDC</p>
                <Badge color={state.color} bg={state.bg}>{state.label}</Badge>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
