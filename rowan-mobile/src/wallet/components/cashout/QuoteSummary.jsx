import { Star, Smartphone, ArrowLeftRight, Hash } from 'lucide-react'
import { NETWORKS, ESTIMATED_DELIVERY } from '../../utils/constants'
import { maskPhoneNumber } from '../../utils/crypto'

function isUsdcQuote(quote) {
  return quote?.depositAsset === 'USDC' || (quote?.usdcAmount != null && Number(quote.usdcAmount) > 0)
}

/**
 * Full quote breakdown card showing the exchange visualization.
 */
export default function QuoteSummary({ quote, phone, requestedFiat }) {
  const network = NETWORKS[quote.network] || {}
  const displayFiat = requestedFiat ?? quote.requestedFiatAmount ?? quote.fiatAmount
  const currency = quote.fiatCurrency || network.currency || 'UGX'
  const usdcQuote = isUsdcQuote(quote)
  const sendAmount = usdcQuote ? quote.usdcAmount : quote.xlmAmount
  const sendLabel = usdcQuote ? 'USDC' : 'XLM'
  const rateLabel = usdcQuote
    ? `1 USDC = ${quote.fiatCurrency} ${quote.userRate ? Number(quote.userRate).toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'N/A'}`
    : `1 XLM = ${quote.fiatCurrency} ${quote.userRate ? Number(quote.userRate).toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'N/A'}`

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-rowan-yellow/20 flex items-center justify-center">
          <Star size={20} className="text-rowan-yellow" />
        </div>
        <div>
          <p className="text-rowan-muted text-xs">You send</p>
          <p className="text-rowan-text text-2xl font-bold tabular-nums">
            {Number(sendAmount).toFixed(4)} {sendLabel}
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
        <div>
          <p className="text-rowan-muted text-xs">You receive</p>
          <p className="text-rowan-green text-2xl font-bold tabular-nums">
            {Number(displayFiat).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
          </p>
        </div>
      </div>

      <div className="border-t border-rowan-border mt-4 pt-4 space-y-2">
        <DetailRow label="Rate" value={rateLabel} />
        <DetailRow label="Platform fee" value={`${quote.platformFee ? Number(quote.platformFee).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'} ${currency}`} />
        <DetailRow label="Network" value={network.label || quote.network} />
        <DetailRow label="Estimated delivery" value={ESTIMATED_DELIVERY} />
        {phone && <DetailRow label="Phone" value={maskPhoneNumber(phone)} />}
      </div>

      <div className="border-t border-rowan-border mt-2 pt-3">
        <div className="flex justify-between py-1">
          <span className="text-rowan-muted text-sm font-medium">You receive</span>
          <span className="text-rowan-green text-sm font-bold tabular-nums">
            {Number(displayFiat).toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 mt-3">
        <Hash size={12} className="text-rowan-muted" />
        <span className="text-rowan-muted text-xs font-mono">
          Quote: {quote.quoteId?.slice(0, 12)}...
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
