import { Wallet, RefreshCw } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

/**
 * Balance card showing the user's XLM balance and fiat equivalent.
 */
export default function BalanceCard({ balance, fiatEquivalent, currency, loading, refreshing, onRefresh }) {
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5 mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-rowan-muted" />
          <span className="text-rowan-muted text-xs uppercase tracking-wider">Your XLM Balance</span>
        </div>
        <button onClick={onRefresh} disabled={refreshing} className="text-rowan-muted p-1">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && balance === null ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size={24} />
        </div>
      ) : (
        <>
          <div className="mt-3">
            <span className="text-rowan-text text-4xl font-bold tabular-nums">
              {balance !== null ? Number(balance).toFixed(2) : '0.00'}
            </span>
            <span className="text-rowan-muted text-lg ml-2">XLM</span>
          </div>
          {fiatEquivalent !== null && fiatEquivalent !== undefined && (
            <p className="text-rowan-muted text-sm tabular-nums mt-1">
              ≈ {currency} {Number(fiatEquivalent).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          )}
        </>
      )}
    </div>
  )
}
