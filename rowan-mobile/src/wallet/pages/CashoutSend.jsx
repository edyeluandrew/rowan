import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, Clock, ShieldCheck } from 'lucide-react'
import { buildAndSignUsdcPayment, submitTransaction } from '../utils/stellar'
import { confirmQuote } from '../api/cashout'
import { getSecure } from '../utils/storage'
import useActiveTransaction from '../hooks/useActiveTransaction'
import CountdownTimer from '../components/ui/CountdownTimer'
import QuoteSummary from '../components/cashout/QuoteSummary'
import TradeNowHero from '../components/cashout/TradeNowHero'
import Button from '../components/ui/Button'
import { mapApiError } from '../utils/apiErrors'
import { createSubmitGuard } from '../utils/submitGuard'
import { formatCurrency } from '../utils/p2pFormat'

export default function CashoutSend() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, network, phone } = location.state || {}
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [quoteExpired, setQuoteExpired] = useState(false)
  const submitGuard = useRef(createSubmitGuard()).current

  useEffect(() => {
    if (!activeLoading && activeTransaction?.id) {
      navigate(`/wallet/transaction/${activeTransaction.id}`, { replace: true })
    }
  }, [activeLoading, activeTransaction, navigate])

  if (!quote) {
    navigate('/wallet/cashout', { replace: true })
    return null
  }

  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL

  const handleSendNow = async () => {
    if (quoteExpired || loading) return
    if (!submitGuard.tryStart()) return
    setLoading(true)
    setError(null)
    try {
      if (!quote.quoteId) {
        throw new Error('Quote is missing an id. Go back and get a new quote.')
      }
      if (!quote.escrowAddress) {
        throw new Error('Quote is missing escrow address. Get a new quote.')
      }
      if (!quote.memo) {
        throw new Error('Quote is missing payment memo. Get a new quote.')
      }

      const stored = await getSecure('rowan_stellar_keypair')
      if (!stored) throw new Error('Wallet not found. Please re-import your wallet.')
      const kp = JSON.parse(stored)
      if (!kp.secretKey) throw new Error('Wallet key data is corrupted. Please re-import your wallet.')

      const sendUsdc = quote.usdcAmount ?? quote.usdc_amount
      const signedXdr = await buildAndSignUsdcPayment({
        sourceSecretKey: kp.secretKey,
        destinationAddress: quote.escrowAddress,
        usdcAmount: sendUsdc,
        memo: quote.memo,
        horizonUrl,
      })
      const txResult = await submitTransaction(signedXdr, horizonUrl)
      const stellarTxHash = txResult.id

      let transactionId = null
      try {
        const response = await confirmQuote({
          quoteId: quote.quoteId,
          stellarTxHash,
        })
        transactionId = response?.transactionId
      } catch (confirmErr) {
        console.warn('[CashoutSend] Confirm quote error (continuing anyway):', confirmErr.message)
      }

      const routeId = transactionId || quote.quoteId
      navigate(`/wallet/transaction/${routeId}`, {
        state: { transactionId: transactionId || null, quoteId: quote.quoteId, stellarTxHash },
        replace: true,
      })
    } catch (err) {
      if (err.response?.status === 410) {
        setError(mapApiError(err, 'Quote expired. Please get a new quote.'))
        setQuoteExpired(true)
      } else {
        setError(mapApiError(err))
      }
      submitGuard.release()
      setLoading(false)
    }
  }

  const handleGetNewQuote = () => {
    navigate('/wallet/cashout', { replace: true })
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          disabled={loading}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center disabled:opacity-40"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Send this USDC</h1>
      </div>

      <TradeNowHero
        step={1}
        title="Send this USDC"
        amountLabel={`${Number(quote.usdcAmount ?? quote.usdc_amount ?? 0).toFixed(4)} USDC`}
        amountCaption={`You'll receive ${formatCurrency(quote.fiatAmount ?? quote.requestedFiatAmount, quote.fiatCurrency)}`}
      />

      <div className="flex items-center justify-between mb-1 bg-rowan-surface rounded-lg p-3 border border-rowan-border">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-rowan-yellow" />
          <span className="text-rowan-muted text-xs">Time remaining</span>
        </div>
        <CountdownTimer
          expiresAt={quote.expiresAt}
          onExpire={() => setQuoteExpired(true)}
        />
      </div>

      <QuoteSummary quote={quote} phone={phone} />

      <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          Your USDC is held until the exact mobile money amount arrives on your phone.
          If payment is not completed in time, your USDC is refunded automatically.
          Tap send once — do not double-send while this page says Sending…
        </p>
      </div>

      {quoteExpired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <Button onClick={handleGetNewQuote}>Get new quote</Button>
        </div>
      )}

      {error && !quoteExpired && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mt-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-rowan-red shrink-0 mt-0.5" />
          <p className="text-rowan-red text-sm">{error}</p>
        </div>
      )}

      {!quoteExpired && (
        <div className="mt-8">
          <Button onClick={handleSendNow} loading={loading} disabled={loading}>
            {loading ? 'Sending… please wait' : 'Send this USDC'}
          </Button>
        </div>
      )}
    </div>
  )
}
