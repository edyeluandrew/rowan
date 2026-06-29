import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowDownLeft, Plus, Clock, Star, AlertTriangle, Bell, Coins, UserCheck } from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import usePreferredFiat from '../hooks/usePreferredFiat'
import useTransactions from '../hooks/useTransactions'
import useActiveTransaction from '../hooks/useActiveTransaction'
import usePushNotifications from '../hooks/usePushNotifications'
import { useNotificationsContext } from '../context/NotificationsContext'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import BalanceCard from '../components/wallet/BalanceCard'
import RateDisplay from '../components/wallet/RateDisplay'
import CashoutInProgressBanner from '../components/cashout/CashoutInProgressBanner'
import ConnectionDot from '../components/ui/ConnectionDot'
import NotificationBadge from '../components/ui/NotificationBadge'
import TransactionCard from '../components/transactions/TransactionCard'
import Button from '../components/ui/Button'
import { CURRENT_NETWORK } from '../utils/constants'
import { fundWithFriendbot } from '../utils/friendbot'
import { xlmToFiat } from '../utils/fiat'
import { getInProgressTransactions } from '../utils/transactions'

export default function Home() {
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const { balance, loading: balanceLoading, refresh: refreshBalance, publicKey } = useWallet()
  const { preferredFiat, setPreferredFiat, ready: fiatPrefReady } = usePreferredFiat()
  const [friendbotState, setFriendbotState] = useState('idle')
  const { rates, allRates, loading: ratesLoading, error: ratesError, refresh: retryRates } = useRates(preferredFiat)
  const { transactions, loading: txLoading } = useTransactions()
  const { activeTransaction, hasActiveOrder } = useActiveTransaction()
  const { unreadCount } = useNotificationsContext()
  const { permissionGranted, dismissed, requestPermission, dismissBanner } = usePushNotifications()

  const inProgress = getInProgressTransactions(transactions)
  const activeCashout = activeTransaction || inProgress[0] || null
  const recent = transactions.filter((tx) => tx.id !== activeCashout?.id).slice(0, 3)

  const xlmRate = rates?.xlmRate
  const fiatEquivalent = balance != null && xlmRate
    ? xlmToFiat(balance, xlmRate)
    : null

  const needsTestFunds = CURRENT_NETWORK.isTest
    && !balanceLoading
    && (balance == null || parseFloat(balance) < 1)
    && !activeCashout

  const handleFriendbot = async () => {
    if (!publicKey) return
    setFriendbotState('loading')
    try {
      await fundWithFriendbot(publicKey)
      setFriendbotState('success')
      refreshBalance()
    } catch {
      setFriendbotState('error')
    }
  }

  if (isLocked) return <BiometricLock />

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-rowan-text text-lg font-bold">Rowan Wallet</h1>
        <div className="flex items-center gap-3">
          <ConnectionDot />
          <button
            onClick={() => navigate('/wallet/notifications')}
            className="relative text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Notifications"
          >
            <Bell size={22} />
            <NotificationBadge count={unreadCount} />
          </button>
        </div>
      </div>

      <BalanceCard
        fiatAmount={fiatPrefReady ? fiatEquivalent : null}
        fiatCurrency={preferredFiat}
        xlmBalance={balance}
        loading={balanceLoading || ratesLoading || !fiatPrefReady}
        refreshing={balanceLoading}
        onRefresh={() => {
          refreshBalance()
          retryRates()
        }}
        onFiatCurrencyChange={setPreferredFiat}
      />

      {activeCashout && <CashoutInProgressBanner transaction={activeCashout} />}

      {needsTestFunds && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4">
          <p className="text-rowan-text text-sm font-medium">Fund your test wallet</p>
          <p className="text-rowan-muted text-xs mt-1">
            Your balance is empty. Get free test XLM from Stellar Friendbot to try cash out and transfers.
          </p>
          <button
            onClick={handleFriendbot}
            disabled={friendbotState === 'loading' || friendbotState === 'success'}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-rowan-yellow text-rowan-bg font-medium rounded-xl px-4 py-3 min-h-11 disabled:opacity-50"
          >
            <Coins size={16} />
            {friendbotState === 'loading' && 'Funding...'}
            {friendbotState === 'success' && 'Funded — balance updating'}
            {friendbotState === 'error' && 'Failed — tap to retry'}
            {friendbotState === 'idle' && 'Get testnet XLM'}
          </button>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={() => navigate('/wallet/receive')}>
          <ArrowDownLeft size={18} />
          Receive XLM
        </Button>
        <Button variant="ghost" onClick={() => navigate('/wallet/add-money')}>
          <Plus size={18} />
          Add money
        </Button>
      </div>

      <div className="mt-3">
        <Button
          onClick={() => navigate('/wallet/cashout')}
          disabled={hasActiveOrder}
        >
          <ArrowDownToLine size={18} />
          Cash Out
        </Button>
        {hasActiveOrder && (
          <p className="text-rowan-muted text-xs text-center mt-2">Complete your current order first</p>
        )}
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => navigate('/wallet/marketplace')}
          disabled={hasActiveOrder}
        >
          <UserCheck size={18} />
          Choose a trader
        </Button>
        {hasActiveOrder && (
          <p className="text-rowan-muted text-xs text-center mt-1">Complete your current order first</p>
        )}
      </div>

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
          <h3 className="text-rowan-text text-sm font-semibold">Recent Activity</h3>
          {transactions.length > 0 && (
            <button
              onClick={() => navigate('/wallet/history')}
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
        ) : recent.length === 0 && !activeCashout ? (
          <div className="bg-rowan-surface rounded-xl p-8 text-center">
            <Star size={32} className="text-rowan-muted mx-auto mb-3" />
            <p className="text-rowan-muted text-sm">No transactions yet</p>
            <p className="text-rowan-muted text-xs mt-1">
              Receive XLM or cash out to get started
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
