import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, UserCheck, ShieldCheck } from 'lucide-react'
import CountdownTimer from '../components/ui/CountdownTimer'
import Button from '../components/ui/Button'
import { confirmBuyOrder } from '../api/buy'
import { formatLockedRateLine, getTraderDisplayName } from '../utils/p2pFormat'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import useWallet from '../hooks/useWallet'
import useRates from '../hooks/useRates'
import useUserCountry from '../hooks/useUserCountry'
import { mapApiError } from '../utils/apiErrors'
import { getRatesHealth, checkRateDrift } from '../utils/quoteSafety'
import { createSubmitGuard } from '../utils/submitGuard'

export default function BuyConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, traderName, selectedAd, express, automated, liveUsdcToFiat: liveAtQuote } = location.state || {}
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { hasUsdcTrustline } = useWallet()
  const { fiatCurrency: userFiat } = useUserCountry()
  const { refresh: refreshRates } = useRates(quote?.fiatCurrency || userFiat)
  const submitGuard = useRef(createSubmitGuard()).current
  const trustlineError =
    error && /trustline|USDC/i.test(error)

  if (!quote) {
    navigate('/wallet/buy', { replace: true })
    return null
  }

  const isAutomated = Boolean(automated || quote.automated)
  const chosenTrader = isAutomated ? null : (traderName || selectedAd?.traderName || quote.traderName)
  const rateLine = quote.fiatCurrency && quote.userRate
    ? formatLockedRateLine(quote.fiatCurrency, quote.userRate)
    : null

  const handleConfirm = async () => {
    if (expired || loading || hasUsdcTrustline === false) return
    if (!submitGuard.tryStart()) return
    setLoading(true)
    setError(null)
    try {
      const snap = await refreshRates()
      const health = getRatesHealth(snap?.rates, snap?.fetchedAt, snap?.error)
      if (!health.ok && express) {
        setError(health.message)
        submitGuard.release()
        setLoading(false)
        return
      }
      if (health.ok) {
        const refRate = liveAtQuote ?? quote.userRate
        const drift = checkRateDrift(refRate, health.usdcToFiat)
        if (drift?.drifted) {
          setError(drift.message)
          submitGuard.release()
          setLoading(false)
          return
        }
      }

      const result = await confirmBuyOrder({ quoteId: quote.quoteId })
      navigate(`/wallet/transaction/${result.transactionId}`, {
        replace: true,
        state: { transactionId: result.transactionId, orderSide: 'BUY' },
      })
    } catch (err) {
      setError(mapApiError(err, 'Could not start order'))
      submitGuard.release()
      setLoading(false)
    }
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Confirm Buy</h1>
      </div>

      {isAutomated && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-medium">Approve the MTN or Airtel prompt</p>
          <p className="text-rowan-muted text-xs mt-1">
            After you confirm, pay the trader via mobile money as instructed.
          </p>
        </div>
      )}

      {express && !isAutomated && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <p className="text-rowan-text text-sm font-medium">Express match</p>
        </div>
      )}

      {chosenTrader && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <UserCheck size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-rowan-text text-sm font-semibold">{getTraderDisplayName(chosenTrader)}</span>
                <ShieldCheck size={14} className="text-rowan-green" />
              </div>
              {rateLine && <p className="text-rowan-muted text-xs mt-2">Rate: {rateLine}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-rowan-muted text-sm">Quote expires</span>
        <CountdownTimer expiresAt={quote.expiresAt} onExpire={() => setExpired(true)} />
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-rowan-muted">You pay</span>
          <span className="text-rowan-text font-semibold">
            {Number(quote.fiatAmount).toLocaleString()} {quote.fiatCurrency}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-rowan-muted">You receive</span>
          <span className="text-rowan-yellow font-semibold">
            {Number(quote.usdcAmount).toFixed(4)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-rowan-muted">Platform fee</span>
          <span className="text-rowan-text">{Number(quote.platformFee).toLocaleString()} {quote.fiatCurrency}</span>
        </div>
      </div>

      {(hasUsdcTrustline === false || trustlineError) && (
        <UsdcTrustlineSetup compact onEnabled={() => setError(null)} />
      )}

      {error && !trustlineError && (
        <div className="mt-4">
          <p className="text-rowan-red text-sm">{error}</p>
          {/new quote|moved about/i.test(error) && (
            <Button
              className="mt-3"
              variant="ghost"
              onClick={() => navigate(isAutomated ? '/wallet/buy' : '/wallet/p2p', { replace: true, state: isAutomated ? undefined : { tab: 'buy' } })}
            >
              Get a new quote
            </Button>
          )}
        </div>
      )}

      <Button
        className="w-full mt-8"
        disabled={expired || loading || hasUsdcTrustline === false}
        loading={loading}
        onClick={handleConfirm}
      >
        {expired ? 'Quote expired' : loading ? 'Starting order…' : isAutomated ? 'Confirm & pay from phone' : 'Confirm & start order'}
      </Button>
    </div>
  )
}
