import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, XCircle, Hash, Clock, ExternalLink, Loader2 } from 'lucide-react'
import Button from '../components/ui/Button'
import { maskPhoneNumber } from '../utils/crypto'
import { labelsFor, getUtilityType, billSandboxFallbackNote } from '../utils/utilityLabels'
import { CURRENT_NETWORK } from '../utils/constants'
import { resolveFiatCurrency, getElectricityTokenLabel } from '../utils/country'
import useUserCountry from '../hooks/useUserCountry'
import { getUtilityBillDelivery } from '../api/utilities'

function resolveStatus(purchase, data) {
  return purchase?.status || data?.status || data?.state || null
}

function isPrepaidBillPayment(data) {
  if (!data || getUtilityType(data) !== 'bill') return false
  return (
    String(data.serviceType || '').toUpperCase() === 'PREPAID'
    || /prepaid/i.test(data.bundleDescription || data.bundle_description || '')
  )
}

export default function UtilityStatus() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { purchase: initialPurchase, quote, phone: phoneFromState, billLookup } = location.state || {}
  const [purchase, setPurchase] = useState(initialPurchase || null)
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const { country: userCountry } = useUserCountry()
  const data = purchase || quote
  const labels = labelsFor(data)

  useEffect(() => {
    if (!id || !isPrepaidBillPayment(data)) return
    const hasReloadlyUnits = purchase?.electricityUnitsSource === 'reloadly' && purchase?.electricityUnits
    const status = resolveStatus(purchase, data)
    if (hasReloadlyUnits && status === 'COMPLETED') return

    let cancelled = false
    setDeliveryLoading(true)

    getUtilityBillDelivery(id)
      .then((result) => {
        if (!cancelled && result) setPurchase(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDeliveryLoading(false)
      })

    return () => { cancelled = true }
  }, [id, data?.type, data?.serviceType, purchase?.electricityUnits, purchase?.electricityUnitsSource])

  if (!data) {
    navigate(labels.utilitiesPath, { replace: true })
    return null
  }

  const status = resolveStatus(purchase, data)
  const completed = status === 'COMPLETED'
  const failed = status === 'FAILED' || status === 'EXPIRED'
  const processing = !completed && !failed
  const externalRef = purchase?.externalRef || data.externalRef || data.external_ref
  const displayPhone = phoneFromState || data.recipientPhone || data.recipient_phone
  const fiatAmount = data.fiatAmount ?? data.fiat_amount
  const billCountry = data.countryCode || data.country_code || userCountry
  const fiatCurrency = resolveFiatCurrency(data.fiatCurrency, data.currency, data.fiat_currency, billCountry)
  const operatorName = data.operatorName || data.operator_name
  const tokenLabel = getElectricityTokenLabel(billCountry)
  const bundleDescription = data.bundleDescription || data.bundle_description
  const paymentTxHash = purchase?.paymentTxHash || data.paymentTxHash || data.payment_tx_hash
  const electricityToken = purchase?.electricityToken || data.electricityToken
  const electricityUnits = purchase?.electricityUnits || data.electricityUnits
  const subscriberName = purchase?.subscriberName || data.subscriberName || billLookup?.customerName
  const unitsFromReloadly = (purchase?.electricityUnitsSource || data.electricityUnitsSource) === 'reloadly'
  const isPrepaidBill = isPrepaidBillPayment(data)
  const explorerUrl = paymentTxHash
    ? `${CURRENT_NETWORK.explorerUrl}/tx/${paymentTxHash}`
    : null

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button
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
            {labels.maskRecipient
              ? `${labels.accountLabel}: ${labels.maskRecipient(displayPhone)}`
              : maskPhoneNumber(displayPhone)}
          </p>
        )}
        {subscriberName && (
          <p className="text-rowan-text text-sm font-medium mt-2">{subscriberName}</p>
        )}
        {completed && bundleDescription && (labels.type === 'data' || labels.type === 'bill') && (
          <p className="text-rowan-green text-lg font-bold mt-4 leading-snug px-2">
            {labels.type === 'bill' ? (data.operatorName || bundleDescription) : bundleDescription}
          </p>
        )}
        {completed && fiatAmount != null && (
          <p className={`text-rowan-green font-bold tabular-nums ${
            bundleDescription && (labels.type === 'data' || labels.type === 'bill') ? 'text-base mt-2' : 'text-2xl mt-4'
          }`}>
            {Number(fiatAmount).toLocaleString()} {fiatCurrency}
          </p>
        )}
        {isPrepaidBill && deliveryLoading && !electricityUnits && (
          <div className="flex items-center justify-center gap-2 mt-4 text-rowan-muted text-sm">
            <Loader2 size={16} className="animate-spin" />
            Fetching units from {operatorName || 'provider'} via Reloadly…
          </div>
        )}
        {isPrepaidBill && unitsFromReloadly && electricityUnits && (
          <div className="mt-4">
            <p className="text-rowan-green text-xl font-bold tabular-nums">{electricityUnits}</p>
            <p className="text-rowan-muted text-xs mt-1">Confirmed by Reloadly{operatorName ? ` / ${operatorName}` : ''}</p>
          </div>
        )}
        {isPrepaidBill && processing && !electricityUnits && !deliveryLoading && (
          <p className="text-rowan-muted text-xs mt-4 px-2">
            Units and {tokenLabel.toLowerCase()} will appear here once Reloadly confirms with the provider (usually within a minute).
          </p>
        )}
        {isPrepaidBill && electricityToken && (
          <div className="mt-4 bg-rowan-bg border border-rowan-border rounded-xl p-3 text-left">
            <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">{tokenLabel}</p>
            <p className="text-rowan-text text-sm font-mono font-semibold break-all leading-relaxed">
              {electricityToken}
            </p>
            <p className="text-rowan-muted text-xs mt-2">
              From Reloadly{operatorName ? ` / ${operatorName}` : ''} — enter on your meter keypad. Your provider may also send by SMS.
            </p>
          </div>
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
        {data.billSettlementFallback && completed && (
          <p className="text-rowan-yellow text-xs mt-3 px-2 leading-relaxed">
            {billSandboxFallbackNote({
              operatorName,
              countryCode: billCountry,
            })}
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
          <span className="font-mono text-rowan-muted no-underline">
            ({paymentTxHash.slice(0, 8)}…)
          </span>
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
