import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Receipt,
  Smartphone,
  Star,
  AlertTriangle,
  Bell,
  RefreshCw,
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

/** Prefer /active API so resume works even if Recent is still loading; enrich from list when present. */
function resolveActiveOrder(apiTx, transactions) {
  const list = Array.isArray(transactions) ? transactions : []
  const fromHistory = getInProgressTransactions(list.filter((tx) => tx.kind !== 'utility'))[0] || null
  if (!apiTx?.id) return fromHistory
  const richer = list.find((tx) => tx.id === apiTx.id && tx.kind !== 'utility')
  return richer ? { ...apiTx, ...richer } : apiTx
}

const ACTIONS = [
  {
    key: 'receive',
    label: 'Receive',
    Icon: ArrowDownLeft,
    path: '/wallet/receive',
    needsOrderLock: false,
  },
  {
    key: 'buy',
    label: 'Buy',
    Icon: ArrowDownToLine,
    path: '/wallet/p2p',
    state: { tab: 'buy' },
    needsOrderLock: true,
  },
  {
    key: 'sell',
    label: 'Sell',
    Icon: ArrowUpFromLine,
    path: '/wallet/p2p',
    state: { tab: 'sell' },
    needsOrderLock: true,
  },
  {
    key: 'bills',
    label: 'Pay Bills',
    Icon: Receipt,
    path: '/wallet/utilities/bills',
    needsOrderLock: false,
  },
  {
    key: 'topup',
    label: 'Top up',
    Icon: Smartphone,
    path: '/wallet/utilities/airtime',
    needsOrderLock: false,
  },
]

function HomeAction({ action, disabled, onNavigate }) {
  const { label, Icon, path, state } = action
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onNavigate(path, state ? { state } : undefined)}
      className="group flex min-h-[4.5rem] flex-col items-center justify-center gap-2 rounded-2xl px-1 py-2.5 disabled:opacity-40"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rowan-bg text-rowan-green transition-colors group-hover:bg-rowan-mint group-active:scale-95">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="text-center text-xs font-medium text-rowan-text font-sans">
        {label}
      </span>
    </button>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
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
  const { activeTransaction, hasActiveOrder, refresh: refreshActive } = useActiveTransaction()
  const { rates, allRates, loading: ratesLoading, error: ratesError, refresh: retryRates } = useRates(fiatCurrency)
  const { transactions, loading: txLoading, refresh: refreshTx } = useTransactions()
  const { unreadCount } = useNotificationsContext()
  const { permissionGranted, dismissed, requestPermission, dismissBanner } = usePushNotifications()

  const activeOrder = resolveActiveOrder(activeTransaction, transactions)
  const recent = transactions
    .filter((tx) => tx.id !== activeOrder?.id)
    .slice(0, 5)

  useEffect(() => {
    if (pathname !== '/wallet/home') return
    refreshBalance()
    refreshTx()
    refreshActive()
  }, [pathname, refreshBalance, refreshTx, refreshActive])

  const usdcToFiatRate = rates?.usdcToFiat
  const spendableUsdc = usdcAvailable ?? usdcBalance
  const fiatEquivalent = spendableUsdc != null && usdcToFiatRate
    ? usdcToFiat(spendableUsdc, usdcToFiatRate)
    : null

  const needsUsdc = !balanceLoading
    && hasUsdcTrustline !== false
    && (usdcBalance == null || parseFloat(usdcBalance) < 0.01)
    && !activeOrder

  const autoFundingTestnet = CURRENT_NETWORK.isTest && needsUsdc

  const pullHome = () => {
    refreshBalance()
    retryRates()
    refreshTx()
    refreshActive()
  }

  if (isLocked) return <BiometricLock />

  return (
    <div className="min-h-screen overflow-y-auto rowan-atmosphere pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-5 animate-rise-in">
        <div>
          <h1 className="font-serif text-2xl text-rowan-green leading-tight">Rowan</h1>
          <p className="text-rowan-muted text-xs font-sans mt-0.5">Borderless value. Local payouts.</p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionDot />
          <button
            type="button"
            onClick={() => navigate('/wallet/notifications')}
            className="relative text-rowan-text bg-rowan-surface border border-rowan-border rounded-full min-h-11 min-w-11 flex items-center justify-center shadow-soft"
            aria-label="Notifications"
          >
            <Bell size={20} />
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
        onRefresh={pullHome}
      />

      <UsdcTrustlineSetup compact onEnabled={refreshBalance} />

      {activeOrder && <CashoutInProgressBanner transaction={activeOrder} />}

      <div className="mt-5 rounded-3xl border border-rowan-border bg-rowan-surface p-2 shadow-soft">
        <div className="grid grid-cols-3">
          {ACTIONS.slice(0, 3).map((action) => (
            <HomeAction key={action.key} action={action} disabled={action.needsOrderLock && (hasActiveOrder || !!activeOrder)} onNavigate={navigate} />
          ))}
        </div>
        <div className="grid grid-cols-2 border-t border-rowan-border/80">
          {ACTIONS.slice(3).map((action) => (
            <HomeAction key={action.key} action={action} disabled={false} onNavigate={navigate} />
          ))}
        </div>
      </div>

      {autoFundingTestnet && testUsdcProvisioning === 'loading' && (
        <div className="mt-4 bg-rowan-mint border border-rowan-green/30 rounded-2xl p-4 flex items-center gap-3">
          <RefreshCw size={18} className="text-rowan-green animate-spin-slow shrink-0" />
          <div>
            <p className="text-rowan-text text-sm font-medium">Setting up your testnet wallet</p>
            <p className="text-rowan-muted text-xs mt-1">
              Adding {TESTNET_AUTO_USDC_AMOUNT} test USDC automatically. No action needed.
            </p>
          </div>
        </div>
      )}

      {autoFundingTestnet && testUsdcProvisioning === 'error' && (
        <div className="mt-4 bg-rowan-mint border border-rowan-border rounded-2xl p-4">
          <p className="text-rowan-text text-sm font-medium">Test USDC is taking longer than usual</p>
          <p className="text-rowan-muted text-xs mt-1">
            Pull to refresh your balance in a moment. If it stays empty, the testnet treasury may need a top-up.
          </p>
        </div>
      )}

      {!permissionGranted && !dismissed && (
        <div className="mt-4 bg-rowan-surface border border-rowan-border rounded-2xl p-4 flex items-start gap-3 shadow-soft">
          <Bell size={20} className="text-rowan-green shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-rowan-text text-sm font-medium">Enable notifications</p>
            <p className="text-rowan-muted text-xs mt-1">
              Get notified when your mobile money payment arrives.
            </p>
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                onClick={requestPermission}
                className="bg-rowan-green text-white text-xs font-medium px-4 py-2 rounded-full min-h-9"
              >
                Enable
              </button>
              <button
                type="button"
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
          <div className="bg-rowan-surface border border-rowan-red/30 rounded-2xl p-4 mb-4 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rowan-red" />
                <span className="text-rowan-text text-sm font-medium">Rates unavailable</span>
              </div>
              <button type="button" onClick={retryRates} className="text-rowan-green text-sm font-medium underline min-h-9">
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
          <h3 className="font-serif text-lg text-rowan-text">Recent</h3>
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/wallet/history')}
              className="text-rowan-green text-xs font-semibold uppercase tracking-wider min-h-9"
            >
              View all
            </button>
          )}
        </div>

        {txLoading && transactions.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin text-rowan-muted">
              <Clock size={20} />
            </div>
          </div>
        ) : recent.length === 0 && !activeOrder ? (
          <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-8 text-center shadow-soft">
            <Star size={28} className="text-rowan-green mx-auto mb-3" />
            <p className="font-serif text-rowan-text text-base">No transactions yet</p>
            <p className="text-rowan-muted text-xs mt-1 font-sans">
              Receive, buy, sell, pay a bill, or top up to get started
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
