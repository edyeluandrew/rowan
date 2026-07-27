import { Smartphone, ArrowLeftRight, Hash } from 'lucide-react'
import { NETWORKS } from '../../utils/constants'
import { maskPhoneNumber } from '../../utils/crypto'
import { labelsFor } from '../../utils/utilityLabels'

/**
 * Airtime / data utility quote breakdown card.
 */
export default function UtilityQuoteSummary({ quote, phone }) {
  const labels = labelsFor(quote)
  const TypeIcon = labels.Icon
  const network = NETWORKS[quote.networkCode] || {}
  const currency = quote.fiatCurrency || network.currency || 'UGX'
  const sendUsdc = quote.usdcAmount ?? quote.usdc_amount
  const fiatAmount = quote.fiatAmount ?? quote.fiat_amount
  const feeUsdc = quote.platformFeeUsdc ?? quote.platform_fee_usdc
  const bundleDescription = quote.bundleDescription || quote.bundle_description
  const isData = labels.type === 'data'
  const isBill = labels.type === 'bill'

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-rowan-yellow/20 flex items-center justify-center">
          <TypeIcon size={20} className="text-rowan-yellow" />
        </div>
        <div>
          <p className="text-rowan-muted text-xs">You send</p>
          <p className="text-rowan-text text-2xl font-bold tabular-nums">
            {Number(sendUsdc).toFixed(4)} USDC
          </p>
        </div>
      </div>

      <div className="flex justify-center my-2">
        <ArrowLeftRight size={14} className="text-rowan-muted" />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-rowan-green/20 flex items-center justify-center">
          <Smartphone size={20} className="text-rowan-green" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-rowan-muted text-xs">{labels.creditLabel}</p>
          {isData && bundleDescription ? (
            <>
              <p className="text-rowan-green text-lg font-bold leading-snug mt-0.5">
                {bundleDescription}
              </p>
              <p className="text-rowan-muted text-sm tabular-nums mt-1">
                {Number(fiatAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
              </p>
            </>
          ) : isBill && bundleDescription ? (
            <>
              <p className="text-rowan-green text-lg font-bold leading-snug mt-0.5">
                {quote.operatorName || bundleDescription}
              </p>
              <p className="text-rowan-muted text-sm tabular-nums mt-1">
                {Number(fiatAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
              </p>
            </>
          ) : (
            <p className="text-rowan-green text-2xl font-bold tabular-nums">
              {Number(fiatAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-rowan-border mt-4 pt-4 space-y-2">
        {isData && bundleDescription && (
          <DetailRow label="Data plan" value={bundleDescription} />
        )}
        <DetailRow label="Product" value={labels.product} />
        {!isBill && (
          <DetailRow label="Network" value={network.label || quote.networkCode} />
        )}
        {isBill && bundleDescription && (
          <DetailRow label="Service" value={bundleDescription} />
        )}
        {phone && (
          <DetailRow
            label={labels.accountLabel || 'Phone'}
            value={labels.maskRecipient ? labels.maskRecipient(phone) : maskPhoneNumber(phone)}
          />
        )}
        {(quote.operatorName || quote.billerName) && labels.type === 'bill' && (
          <DetailRow label="Provider" value={quote.operatorName || quote.billerName} />
        )}
        {feeUsdc != null && (
          <DetailRow label="Platform fee" value={`${Number(feeUsdc).toFixed(4)} USDC`} />
        )}
        {quote.reloadlyMock && (
          <DetailRow label="Mode" value="Sandbox mock" />
        )}
      </div>

      <div className="flex items-center gap-1 mt-3">
        <Hash size={12} className="text-rowan-muted" />
        <span className="text-rowan-muted text-xs font-mono">
          Memo: {quote.memo}
        </span>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-rowan-muted text-sm">{label}</span>
      <span className="text-rowan-text text-sm tabular-nums">{value}</span>
    </div>
  )
}
