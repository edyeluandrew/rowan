import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, Clock, ShieldCheck } from 'lucide-react'
import { buildAndSignUsdcPayment, submitTransaction } from '../utils/stellar'
import { completeUtilityPurchase } from '../api/utilities'
import { getSecure } from '../utils/storage'
import CountdownTimer from '../components/ui/CountdownTimer'
import UtilityQuoteSummary from '../components/utilities/UtilityQuoteSummary'
import Button from '../components/ui/Button'
import { getHorizonUrl } from '../../shared/utils/config'
import { labelsFor, getUtilityType } from '../utils/utilityLabels'
import { mapApiError } from '../utils/apiErrors'
import { createSubmitGuard } from '../utils/submitGuard'

export default function UtilitiesSend() {
  const navigate = useNavigate()
  const location = useLocation()
  const { quote, phone, mockPurchaseAllowed, utilityType, billLookup } = location.state || {}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [quoteExpired, setQuoteExpired] = useState(false)
  const submitGuard = useRef(createSubmitGuard()).current

  const labels = labelsFor({ type: utilityType || getUtilityType(quote) })
  const horizonUrl = getHorizonUrl()

  if (!quote) {
    navigate(labels.utilitiesPath || '/wallet/utilities/airtime', { replace: true })
    return null
  }

  const useMockPath = mockPurchaseAllowed && quote.reloadlyMock

  const finishPurchase = async (paymentTxHash) => {
    const result = await completeUtilityPurchase({
      quoteId: quote.quoteId || quote.id,
      paymentTxHash,
    })
    navigate(`/wallet/utilities/status/${result.id || quote.quoteId || quote.id}`, {
      state: { purchase: result, quote, phone, utilityType: getUtilityType(quote), billLookup },
      replace: true,
    })
  }

  const handlePay = async () => {
    if (quoteExpired || loading) return
    if (!submitGuard.tryStart()) return
    setLoading(true)
    setError(null)
    try {
      if (useMockPath) {
        await finishPurchase(null)
        return
      }

      const treasury = quote.treasuryPublicKey
      const sendUsdc = quote.usdcAmount ?? quote.usdc_amount
      const memo = quote.memo

      if (!treasury || !sendUsdc || !memo) {
        throw new Error('Quote missing payment details. Get a new quote.')
      }

      const stored = await getSecure('rowan_stellar_keypair')
      if (!stored) throw new Error('Wallet not found. Please re-import your wallet.')
      const kp = JSON.parse(stored)
      if (!kp.secretKey) throw new Error('Wallet key data is corrupted.')

      const signedXdr = await buildAndSignUsdcPayment({
        sourceSecretKey: kp.secretKey,
        destinationAddress: treasury,
        usdcAmount: sendUsdc,
        memo,
        horizonUrl,
      })
      const txResult = await submitTransaction(signedXdr, horizonUrl)
      await finishPurchase(txResult.id)
      // leave guard locked — screen unmounts after navigate
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
        <h1 className="text-rowan-text text-lg font-bold">
          {useMockPath ? 'Complete purchase' : 'Send USDC'}
        </h1>
      </div>

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

      <UtilityQuoteSummary quote={quote} phone={phone} billLookup={billLookup} />

      {!useMockPath && (
        <div className="bg-rowan-surface rounded-xl p-4 mt-4 flex items-start gap-3">
          <ShieldCheck size={20} className="text-rowan-green shrink-0 mt-0.5" />
          <p className="text-rowan-muted text-xs">
            Send exactly {Number(quote.usdcAmount).toFixed(4)} USDC with memo{' '}
            <span className="font-mono text-rowan-text">{quote.memo}</span> {labels.deliveryNote}
            {' '}Tap pay once — do not double-send.
          </p>
        </div>
      )}

      {useMockPath && (
        <div className="bg-rowan-mint border border-rowan-green/30 rounded-xl p-4 mt-4">
          <p className="text-rowan-text text-xs">
            Staging mock — skips on-chain USDC. Reloadly sandbox mock will simulate the top-up.
          </p>
        </div>
      )}

      {quoteExpired && (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
          <Button onClick={() => navigate(labels.utilitiesPath, { replace: true })}>
            Get new quote
          </Button>
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
          <Button onClick={handlePay} loading={loading} disabled={loading}>
            {loading
              ? 'Sending… please wait'
              : useMockPath
                ? 'Complete test purchase'
                : labels.sendButton}
          </Button>
        </div>
      )}
    </div>
  )
}
