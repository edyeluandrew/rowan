import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, Clock, ShieldCheck } from 'lucide-react'
import { buildAndSignPayment, submitTransaction } from '../utils/stellar'
import { confirmQuote } from '../api/cashout'
import { getSecure } from '../utils/storage'
import useActiveTransaction from '../hooks/useActiveTransaction'
import CountdownTimer from '../components/ui/CountdownTimer'
import QuoteSummary from '../components/cashout/QuoteSummary'
import Button from '../components/ui/Button'

export default function CashoutSend() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, network, phone } = location.state || {}
  const { activeTransaction, loading: activeLoading } = useActiveTransaction()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [quoteExpired, setQuoteExpired] = useState(false)

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
    if (quoteExpired) return
    setLoading(true)
    setError(null)
    try {
      if (!quote.quoteId) {
        throw new Error(`Quote object missing quoteId. Quote: ${JSON.stringify(quote)}`)
      }
      if (!quote.escrowAddress) {
        throw new Error(`Quote object missing escrowAddress. Quote: ${JSON.stringify(quote)}`)
      }
      if (!quote.memo) {
        throw new Error(`Quote object missing memo. Quote: ${JSON.stringify(quote)}`)
      }

      const stored = await getSecure('rowan_stellar_keypair')
      if (!stored) throw new Error('Wallet not found. Please re-import your wallet.')
      const kp = JSON.parse(stored)
      if (!kp.secretKey) throw new Error('Wallet key data is corrupted. Please re-import your wallet.')

      const signedXdr = await buildAndSignPayment({
        sourceSecretKey: kp.secretKey,
        destinationAddress: quote.escrowAddress,
        xlmAmount: quote.xlmAmount,
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
        setError('Quote expired. Please get a new quote.')
        setQuoteExpired(true)
      } else {
        setError(err.message)
      }
    } finally {
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
          onClick={() => navigate(-1)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Back"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Send XLM</h1>
      </div>

      <div className="flex items-center justify-between mb-1 bg-rowan-surface rounded-lg p-3 border border-rowan-border">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-rowan-yellow" />
          <span className="text-rowan-muted text-xs">Time to send XLM</span>
        </div>
        <CountdownTimer
          expiresAt={quote.expiresAt}
          onExpire={() => setQuoteExpired(true)}
        />
      </div>
      <p className="text-rowan-muted text-xs mb-4 px-1">
        Send before this timer ends. Mobile money timing starts after your XLM is received.
      </p>

      <QuoteSummary quote={quote} phone={phone} />

      <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
        <p className="text-rowan-muted text-xs">
          Your XLM is sent to escrow and held until mobile money arrives on your phone.
          If payment is not completed in time, your XLM is refunded automatically.
        </p>
      </div>

      {quoteExpired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-rowan-yellow" />
            <p className="text-rowan-yellow font-bold text-sm">Quote Expired</p>
          </div>
          <p className="text-rowan-muted text-xs mb-3">This quote is no longer valid. Please request a new one.</p>
          <Button onClick={handleGetNewQuote}>Get New Quote</Button>
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
          <Button onClick={handleSendNow} loading={loading}>
            Send XLM
          </Button>
        </div>
      )}
    </div>
  )
}
