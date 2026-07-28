import { useNavigate } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Signal,
  Star,
  AlertTriangle,
  Bell,
  RefreshCw,
  Zap,
} from 'lucide-react'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import useActiveTransaction from '../hooks/useActiveTransaction'
import useTransactions from '../hooks/useTransactions'
import usePushNotifications from '../hooks/usePushNotifications'
import { useNotificationsContext } from '../context/NotificationsContext'
import useBiometricProtection from '../../shared/hooks/useBiometricProtection'
import BiometricLock from '../../shared/components/BiometricLock'
import BalanceCard from '../components/wallet/BalanceCard'
import RateDisplay from '../components/wallet/RateDisplay'
import CashoutInProgressBanner from '../components/cashout/CashoutInProgressBanner'
import ConnectionDot from '../components/ui/ConnectionDot'
import NotificationBadge from '../components/ui/NotificationBadge'
import HistoryItemCard from '../components/history/HistoryItemCard'
import { CURRENT_NETWORK, TESTNET_AUTO_USDC_AMOUNT } from '../utils/constants'
import { usdcToFiat } from '../utils/fiat'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import { getInProgressTransactions } from '../utils/transactions'

export default function Home() {
  const navigate = useNavigate()
  const { isLocked } = useBiometricProtection()
  const {
    usdcBalance,
    usdcAvailable,
    usdcLocked,
    hasUsdcTrustline,
    loading: balanceLoading,
    refresh: refreshBalance,
    testUsdcProvisioning,
  } = useWallet()
  const { country, fiatCurrency, ready: countryReady } = useUserCountry()
  const { hasActiveOrder } = useActiveTransaction()
  const { rates, allRates, loading: ratesLoading, error: ratesError, refresh: retryRates } = useRates(fiatCurrency)
  const { transactions, loading: txLoading } = useTransactions()
  const { unreadCount } = useNotificationsContext()
  const { permissionGranted, dismissed, requestPermission, dismissBanner } = usePushNotifications()

  const inProgress = getInProgressTransactions(transactions)
  const activeCashout = inProgress[0] || null
  const recent = transactions.filter((tx) => tx.id !== activeCashout?.id).slice(0, 3)

  const usdcToFiatRate = rates?.usdcToFiat
  const spendableUsdc = usdcAvailable ?? usdcBalance
  const fiatEquivalent = spendableUsdc != null && usdcToFiatRate
    ? usdcToFiat(spendableUsdc, usdcToFiatRate)
    : null

  const needsUsdc = !balanceLoading
    && hasUsdcTrustline !== false
    && (usdcBalance == null || parseFloat(usdcBalance) < 0.01)
    && !activeCashout

  const autoFundingTestnet = CURRENT_NETWORK.isTest && needsUsdc

  if (isLocked) return <BiometricLock />

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-rowan-text text-lg font-bold leading-tight">Rowan</h1>
          <p className="text-rowan-muted text-xs">Borderless value. Local payouts.</p>
        </div>
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
        fiatAmount={countryReady ? fiatEquivalent : null}
        fiatCurrency={fiatCurrency}
        usdcBalance={usdcBalance}
        usdcAvailable={usdcAvailable}
        usdcLocked={usdcLocked}
        loading={balanceLoading || ratesLoading || !countryReady}
        refreshing={balanceLoading}
        onRefresh={() => {
          refreshBalance()
          retryRates()
        }}
      />

      <UsdcTrustlineSetup compact onEnabled={refreshBalance} />

      {activeCashout && <CashoutInProgressBanner transaction={activeCashout} />}

      {/* Primary actions */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => navigate('/wallet/receive')}
          className="bg-rowan-surface border border-rowan-border rounded-xl px-2 py-3 min-h-11 flex flex-col items-center justify-center gap-1.5"
        >
          <ArrowDownLeft size={20} className="text-rowan-green" />
          <span className="text-rowan-text text-xs font-medium">Receive</span>
        </button>
        <button
          type="button"
          disabled={hasActiveOrder}
          onClick={() => navigate('/wallet/p2p', { state: { tab: 'buy' } })}
          className="bg-rowan-surface border border-rowan-border rounded-xl px-2 py-3 min-h-11 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <ArrowDownToLine size={20} className="text-rowan-green" />
          <span className="text-rowan-text text-xs font-medium">Buy</span>
        </button>
        <button
          type="button"
          disabled={hasActiveOrder}
          onClick={() => navigate('/wallet/p2p', { state: { tab: 'sell' } })}
          className="bg-rowan-surface border border-rowan-border rounded-xl px-2 py-3 min-h-11 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
        >
          <ArrowUpFromLine size={20} className="text-rowan-green" />
          <span className="text-rowan-text text-xs font-medium">Sell</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/wallet/utilities/airtime')}
          className="bg-rowan-surface border border-rowan-border rounded-xl px-2 py-3 min-h-11 flex flex-col items-center justify-center gap-1.5"
        >
          <Signal size={20} className="text-rowan-gold" />
          <span className="text-rowan-text text-xs font-medium">Airtime</span>
        </button>
      </div>

      <button
        type="button"
        disabled={hasActiveOrder}
        onClick={() => navigate('/wallet/cashout', { state: { kotaniDirect: true } })}
        className="mt-2 w-full bg-rowan-yellow/10 border border-rowan-yellow/40 rounded-xl px-4 py-3 min-h-11 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Zap size={18} className="text-rowan-yellow shrink-0" />
        <span className="text-rowan-text text-sm font-semibold">Kotani</span>
        <span className="text-rowan-muted text-xs font-normal">sandbox test · no trader</span>
      </button>

      {autoFundingTestnet && testUsdcProvisioning === 'loading' && (
        <div className="mt-4 bg-rowan-mint border border-rowan-green/30 rounded-xl p-4 flex items-center gap-3">
          <RefreshCw size={18} className="text-rowan-green animate-spin-slow shrink-0" />
          <div>
            <p className="text-rowan-text text-sm font-medium">Setting up your testnet wallet</p>
            <p className="text-rowan-muted text-xs mt-1">
              Adding {TESTNET_AUTO_USDC_AMOUNT} test USDC automatically — no action needed.
            </p>
          </div>
        </div>
      )}

      {autoFundingTestnet && testUsdcProvisioning === 'error' && (
        <div className="mt-4 bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4">
          <p className="text-rowan-text text-sm font-medium">Test USDC is taking longer than usual</p>
          <p className="text-rowan-muted text-xs mt-1">
            Pull to refresh your balance in a moment. If it stays empty, the testnet treasury may need a top-up.
          </p>
        </div>
      )}

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
          <RateDisplay allRates={allRates} loading={ratesLoading} country={country} />
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-rowan-text text-sm font-semibold">Recent</h3>
          {transactions.length > 0 && (
            <button
              onClick={() => navigate('/wallet/history')}
              className="text-rowan-yellow text-xs min-h-9"
            >
              View all
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
              Receive, buy, sell, or buy airtime to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <HistoryItemCard key={`${tx.kind || 'p2p'}-${tx.id}`} transaction={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
