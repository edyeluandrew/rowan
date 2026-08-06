import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, XCircle, Hash, Clock, ExternalLink } from 'lucide-react'
import Button from '../components/ui/Button'
import { maskPhoneNumber } from '../utils/crypto'
import { labelsFor } from '../utils/utilityLabels'
import { CURRENT_NETWORK } from '../utils/constants'
import { resolveFiatCurrency } from '../utils/country'

function resolveStatus(purchase, data) {
  return purchase?.status || data?.status || data?.state || null
}

export default function UtilityStatus() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { purchase, quote, phone: phoneFromState } = location.state || {}
  const data = purchase || quote
  const labels = labelsFor(data)

  if (!data) {
    navigate(labels.utilitiesPath, { replace: true })
    return null
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

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate('/wallet/home')}
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
        {data.reloadlyMock && completed && (
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
        <Button onClick={() => navigate(labels.utilitiesPath)}>
          {labels.buyMore}
        </Button>
        <button
          type="button"
          onClick={() => navigate('/wallet/home')}
          className="w-full text-rowan-muted text-sm min-h-11"
        >
          Back to home
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
