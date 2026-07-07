import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, ShieldCheck, AlertTriangle, UserCheck, Lock } from 'lucide-react'
import QuoteSummary from '../components/cashout/QuoteSummary'
import CountdownTimer from '../components/ui/CountdownTimer'
import Button from '../components/ui/Button'
import { getActiveTransaction } from '../api/user'
import {
  formatLockedRateLine,
  formatXlmRateLine,
  getTraderDisplayName,
} from '../utils/p2pFormat'

export default function CashoutConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, network, phone, requestedFiat, traderName, selectedAd } = location.state || {}
  const [expired, setExpired] = useState(false)
  const [checkingActive, setCheckingActive] = useState(false)
  const [activeError, setActiveError] = useState(null)

  if (!quote) {
    navigate('/wallet/cashout', { replace: true })
    return null
  }

  const chosenTrader = traderName || selectedAd?.traderName
  const rateLine = quote.fiatCurrency && quote.userRate
    ? formatLockedRateLine(quote.fiatCurrency, quote.userRate)
    : null

  const handleConfirm = async () => {
    if (expired) return
    setCheckingActive(true)
    setActiveError(null)
    try {
      const data = await getActiveTransaction()
      if (data?.active && data.transaction?.id) {
        setActiveError('You already have an active order in progress.')
        setTimeout(() => {
          navigate(`/wallet/transaction/${data.transaction.id}`, { replace: true })
        }, 1500)
        return
      }
      navigate('/wallet/cashout/send', {
        state: {
          quote,
          network,
          phone,
        },
        replace: true,
      })
    } catch {
      setActiveError('Could not verify order status. Please try again.')
    } finally {
      setCheckingActive(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Confirm Quote</h1>
      </div>

      {chosenTrader && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <UserCheck size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
            <div>
              <p className="text-rowan-text text-sm font-semibold">Your chosen trader</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-rowan-text text-sm">{getTraderDisplayName(chosenTrader)}</span>
                <ShieldCheck size={14} className="text-rowan-green" />
              </div>
              {rateLine && (
                <p className="text-rowan-muted text-xs mt-2 flex items-center gap-1 flex-wrap">
                  <span>Rate: {rateLine}</span>
                  <Lock size={12} className="text-rowan-muted shrink-0" />
                  <span>Locked for this order</span>
                </p>
              )}
              <p className="text-rowan-muted text-xs mt-2">
                Only this trader will handle your order. If they are unavailable, we will wait and retry — we will not auto-match someone else.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <span className="text-rowan-muted text-sm">Time to send USDC</span>
        <CountdownTimer
          expiresAt={quote.expiresAt}
          onExpire={() => setExpired(true)}
        />
      </div>
      <p className="text-rowan-muted text-xs mb-4">
        This timer is only for sending USDC from your wallet. After that, we match a trader and send mobile money separately.
      </p>

      <QuoteSummary quote={quote} phone={phone} requestedFiat={requestedFiat} />

      <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          After you send USDC, funds are held safely until mobile money arrives on your phone.
          If payment is not completed in time, your USDC will be returned to your wallet.
        </p>
      </div>

      {expired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-rowan-yellow" />
            <p className="text-rowan-yellow font-bold text-sm">Quote Expired</p>
          </div>
          <p className="text-rowan-muted text-xs mb-3">This quote is no longer valid. Please request a new one.</p>
          <Button onClick={() => navigate('/wallet/cashout', { replace: true })}>
            Get New Quote
          </Button>
        </div>
      )}

      {!expired && activeError && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-4">
          <p className="text-rowan-red text-sm">{activeError}</p>
        </div>
      )}

      {!expired && (
        <div className="mt-8">
          <Button onClick={handleConfirm} loading={checkingActive}>
            Confirm and Proceed
          </Button>
        </div>
      )}
    </div>
  )
}
