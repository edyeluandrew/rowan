import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft, UserCheck, ShieldCheck } from 'lucide-react'
import CountdownTimer from '../components/ui/CountdownTimer'
import Button from '../components/ui/Button'
import { confirmBuyOrder } from '../api/buy'
import { formatLockedRateLine, getTraderDisplayName } from '../utils/p2pFormat'
import UsdcTrustlineSetup from '../components/wallet/UsdcTrustlineSetup'
import useWallet from '../hooks/useWallet'

export default function BuyConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, traderName, selectedAd } = location.state || {}
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { hasUsdcTrustline } = useWallet()
  const trustlineError =
    error && /trustline|USDC/i.test(error)

  if (!quote) {
    navigate('/wallet/buy', { replace: true })
    return null
  }

  const chosenTrader = traderName || selectedAd?.traderName
  const rateLine = quote.fiatCurrency && quote.userRate
    ? formatLockedRateLine(quote.fiatCurrency, quote.userRate)
    : null

  const handleConfirm = async () => {
    if (expired || loading || hasUsdcTrustline === false) return
    setLoading(true)
    setError(null)
    try {
      const result = await confirmBuyOrder({ quoteId: quote.quoteId })
      navigate(`/wallet/transaction/${result.transactionId}`, {
        replace: true,
        state: { transactionId: result.transactionId, orderSide: 'BUY' },
      })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start order')
    } finally {
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

      {chosenTrader && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <UserCheck size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
            <div>
              <p className="text-rowan-text text-sm font-semibold">Trader</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-rowan-text text-sm">{getTraderDisplayName(chosenTrader)}</span>
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

      <p className="text-rowan-muted text-xs mt-4">
        After you confirm, the trader must lock USDC in escrow. Then you send mobile money and upload proof.
      </p>

      {(hasUsdcTrustline === false || trustlineError) && (
        <UsdcTrustlineSetup compact onEnabled={() => setError(null)} />
      )}

      {error && !trustlineError && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      <Button
        className="w-full mt-8"
        disabled={expired || loading || hasUsdcTrustline === false}
        loading={loading}
        onClick={handleConfirm}
      >
        {expired ? 'Quote expired' : 'Confirm & start order'}
      </Button>
    </div>
  )
}
