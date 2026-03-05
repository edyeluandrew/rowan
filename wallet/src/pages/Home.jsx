import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, Clock, Star, AlertTriangle, Bell } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useTransactions from '../hooks/useTransactions'
import usePushNotifications from '../hooks/usePushNotifications'
import BalanceCard from '../components/wallet/BalanceCard'
import RateDisplay from '../components/wallet/RateDisplay'
import ConnectionDot from '../components/ui/ConnectionDot'
import TransactionCard from '../components/transactions/TransactionCard'
import Button from '../components/ui/Button'

export default function Home() {
  const navigate = useNavigate()
  const { balance, loading: balanceLoading, refresh: refreshBalance, publicKey } = useWallet()
  const { rates, allRates, loading: ratesLoading, error: ratesError, refresh: retryRates } = useRates()
  const { transactions, loading: txLoading } = useTransactions()
  const { permissionGranted, dismissed, requestPermission, dismissBanner } = usePushNotifications()

  const recent = transactions.slice(0, 3)

  const fiatEquivalent = balance != null && rates?.xlmToUgx
    ? parseFloat(balance) * rates.xlmToUgx
    : null

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-rowan-text text-lg font-bold">Rowan Wallet</h1>
        <div className="flex items-center gap-3">
          <ConnectionDot />
        </div>
      </div>

      <BalanceCard
        balance={balance}
        fiatEquivalent={fiatEquivalent}
        currency="UGX"
        loading={balanceLoading}
        refreshing={balanceLoading}
        onRefresh={refreshBalance}
      />

      <div className="mt-4">
        <Button onClick={() => navigate('/cashout')}>
          <ArrowDownToLine size={18} className="mr-2" />
          Cash Out
        </Button>
      </div>

      {/* Push notification permission banner */}
      {!permissionGranted && !dismissed && (
        <div className="mt-4 bg-rowan-surface border border-rowan-border rounded-xl p-4 flex items-start gap-3">
          <Bell size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-rowan-text text-sm font-medium">Enable notifications</p>
            <p className="text-rowan-muted text-xs mt-1">
              Get notified when your mobile money payment arrives.
            </p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={requestPermission}
                className="bg-rowan-yellow text-rowan-bg text-xs font-medium px-4 py-2 rounded-lg min-h-9"
              >
                Enable
              </button>
              <button
                onClick={dismissBanner}
                className="text-rowan-muted text-xs min-h-9"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {ratesError ? (
          <div className="bg-rowan-surface border border-rowan-red/30 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rowan-red" />
                <span className="text-rowan-text text-sm font-medium">Rates unavailable</span>
              </div>
              <button onClick={retryRates} className="text-rowan-yellow text-sm font-medium underline min-h-9">
                Retry
              </button>
            </div>
            <p className="text-rowan-muted text-xs mt-2">
              Could not connect to the server. Check your internet connection and try again.
            </p>
          </div>
        ) : (
          <RateDisplay allRates={allRates} loading={ratesLoading} />
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-rowan-text text-sm font-semibold">Recent Transactions</h3>
          {recent.length > 0 && (
            <button
              onClick={() => navigate('/history')}
              className="text-rowan-yellow text-xs"
            >
              View All
            </button>
          )}
        </div>

        {txLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin text-rowan-muted">
              <Clock size={20} />
            </div>
          </div>
        ) : recent.length === 0 ? (
          <div className="bg-rowan-surface rounded-xl p-8 text-center">
            <Star size={32} className="text-rowan-muted mx-auto mb-3" />
            <p className="text-rowan-muted text-sm">No transactions yet</p>
            <p className="text-rowan-muted text-xs mt-1">
              Cash out XLM to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <TransactionCard key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
