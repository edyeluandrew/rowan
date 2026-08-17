import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, XCircle, Hash, Clock, ExternalLink, Loader2 } from 'lucide-react'
import Button from '../components/ui/Button'
import { maskPhoneNumber } from '../utils/crypto'
import { labelsFor } from '../utils/utilityLabels'
import { CURRENT_NETWORK } from '../utils/constants'
import { resolveFiatCurrency } from '../utils/country'
import { getUtilityPurchase, completeUtilityPurchase } from '../api/utilities'
import useWallet from '../hooks/useWallet'

function resolveStatus(purchase, data) {
  return purchase?.status || data?.status || data?.state || null
}

export default function UtilityStatus() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { purchase: statePurchase, quote, phone: phoneFromState } = location.state || {}
  const { refresh: refreshBalance } = useWallet()
  const [purchase, setPurchase] = useState(statePurchase || null)
  const [loadError, setLoadError] = useState(null)
  const [loading, setLoading] = useState(!statePurchase && !!id)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState(null)

  const data = purchase || quote
  const labels = labelsFor(data || quote || {})

  // Deep-link / history resume: load by id when no navigation state
  useEffect(() => {
    if (statePurchase || !id) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getUtilityPurchase(id)
      .then((result) => {
        if (!cancelled) setPurchase(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.response?.data?.error || err.message || 'Could not load purchase')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, statePurchase])

  // After buy, balance changed — soft-refresh Horizon so Home is current
  useEffect(() => {
    const status = resolveStatus(purchase, data)
    if (status === 'COMPLETED' || status === 'FAILED') {
      refreshBalance()
    }
  }, [purchase?.status, data?.status, refreshBalance])

  const goHome = () => navigate('/wallet/home', { replace: false })

  const handleRetryBill = async () => {
    const quoteId = purchase?.id || data?.id || id
    const txHash = purchase?.paymentTxHash || data?.paymentTxHash || data?.payment_tx_hash
    if (!quoteId || retrying) return
    setRetrying(true)
    setRetryError(null)
    try {
      const result = await completeUtilityPurchase({
        quoteId,
        paymentTxHash: txHash,
      })
      setPurchase(result)
    } catch (err) {
      setRetryError(err.response?.data?.error || err.message || 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4 flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="text-rowan-muted animate-spin" />
        <p className="text-rowan-muted text-sm">Loading purchase…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={goHome}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-rowan-text text-lg font-bold">Purchase</h1>
        </div>
        <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-6 text-center">
          <p className="text-rowan-text text-sm">
            {loadError || 'Purchase not found'}
          </p>
          <Button className="mt-4" onClick={goHome}>Back to home</Button>
        </div>
      </div>
    )
  }

  const status = resolveStatus(purchase, data)
  const completed = status === 'COMPLETED'
  const failed = status === 'FAILED' || status === 'EXPIRED'
  const externalRef = purchase?.externalRef || data.externalRef || data.external_ref
  const displayPhone = phoneFromState || data.recipientPhone || data.recipient_phone
  const fiatAmount = data.fiatAmount ?? data.fiat_amount
  const fiatCurrency = resolveFiatCurrency(data.fiatCurrency, data.currency, data.fiat_currency)
  const bundleDescription = data.bundleDescription || data.bundle_description
  const paymentTxHash = purchase?.paymentTxHash || data.paymentTxHash || data.payment_tx_hash
  const explorerUrl = paymentTxHash
    ? `${CURRENT_NETWORK.explorerUrl}/tx/${paymentTxHash}`
    : null
  const canRetryBill = failed && Boolean(paymentTxHash)

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={goHome}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">{labels.receiptTitle}</h1>
      </div>

      <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-6 text-center">
        {completed ? (
          <CheckCircle2 size={48} className="text-rowan-green mx-auto mb-4" />
        ) : failed ? (
          <XCircle size={48} className="text-rowan-red mx-auto mb-4" />
        ) : (
          <Clock size={48} className="text-rowan-yellow mx-auto mb-4" />
        )}
        <p className="text-rowan-text text-lg font-bold">
          {completed ? labels.successTitle : failed ? 'Purchase failed' : 'Processing'}
        </p>
        {displayPhone && (
          <p className="text-rowan-muted text-sm mt-2">
            {maskPhoneNumber(displayPhone)}
          </p>
        )}
        {completed && bundleDescription && labels.type === 'data' && (
          <p className="text-rowan-green text-lg font-bold mt-4 leading-snug px-2">
            {bundleDescription}
          </p>
        )}
        {completed && fiatAmount != null && (
          <p className={`text-rowan-green font-bold tabular-nums ${
            bundleDescription && labels.type === 'data' ? 'text-base mt-2' : 'text-2xl mt-4'
          }`}>
            {Number(fiatAmount).toLocaleString()} {fiatCurrency}
          </p>
        )}
        {externalRef && (
          <div className="flex items-center justify-center gap-1 mt-4 text-rowan-muted text-xs">
            <Hash size={12} />
            <span className="font-mono">Ref: {externalRef}</span>
          </div>
        )}
        {(purchase?.errorMessage || data.errorMessage || data.error_message) && (
          <p className="text-rowan-red text-sm mt-4">
            {purchase?.errorMessage || data.errorMessage || data.error_message}
          </p>
        )}
        {retryError && (
          <p className="text-rowan-red text-sm mt-2">{retryError}</p>
        )}
        {(data.reloadlyMock || data.marzPayMock) && completed && (
          <p className="text-rowan-muted text-xs mt-3">{labels.mockNote}</p>
        )}
      </div>

      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-rowan-yellow text-xs underline mt-4 min-h-11"
        >
          <ExternalLink size={14} />
          View payment on Stellar Explorer
        </a>
      )}

      <div className="mt-8 space-y-3">
        {canRetryBill && (
          <Button onClick={handleRetryBill} loading={retrying} disabled={retrying}>
            {retrying ? 'Retrying bill…' : 'Retry bill payment (no extra USDC)'}
          </Button>
        )}
        <Button onClick={goHome}>
          Done — back to home
        </Button>
        <button
          type="button"
          onClick={() => navigate(labels.utilitiesPath)}
          className="w-full text-rowan-muted text-sm min-h-11"
        >
          {labels.buyMore}
        </button>
      </div>

      {!explorerUrl && id && (
        <p className="text-rowan-muted text-xs text-center mt-6 font-mono">
          {id.slice(0, 8)}…
        </p>
      )}
    </div>
  )
}
