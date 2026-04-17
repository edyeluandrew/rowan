import { Star, Coins, Smartphone, ArrowDown, Hash, Zap, AlertCircle } from 'lucide-react'
import { NETWORKS, ESTIMATED_DELIVERY } from '../../utils/constants'
import { maskPhoneNumber } from '../../utils/crypto'

/**
 * [PHASE 1] Enhanced quote breakdown card with clear conversion visualization.
 * 
 * Shows the complete cashout path:
 * 1. You send: XLM
 * 2. Converted via Stellar liquidity: USDC
 * 3. You receive: Fiat (via trader)
 * 4. Fees and details
 * 
 * Builds trust by making the conversion step explicit.
 */
export default function QuoteSummary({ quote }) {
  const network = NETWORKS[quote.network] || {}

  // Calculate total fees in fiat for transparency
  const totalFeesFiat = Number(quote.platformFee || 0)
  const feePercentage = quote.spreadPercent ? (Number(quote.spreadPercent) * 100).toFixed(2) : 'N/A'

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5">
      {/* ── MAIN CONVERSION FLOW (vertically stacked for mobile clarity) ── */}
      
      {/* Step 1: You send XLM */}
      <div className="flex items-center gap-3 pb-4">
        <div className="w-10 h-10 rounded-full bg-rowan-yellow/20 flex items-center justify-center shrink-0">
          <Star size={20} className="text-rowan-yellow" />
        </div>
        <div className="flex-1">
          <p className="text-rowan-muted text-xs">You send</p>
          <p className="text-rowan-text text-xl font-bold tabular-nums">{quote.xlmAmount} XLM</p>
        </div>
      </div>

      {/* Arrow and context */}
      <div className="flex justify-center mb-3">
        <div className="flex flex-col items-center gap-1">
          <ArrowDown size={16} className="text-rowan-muted animate-pulse" />
          <p className="text-rowan-muted text-xs text-center px-2">
            Converted via Stellar
          </p>
        </div>
      </div>

      {/* Step 2: Stable value (USDC) - now more prominent */}
      <div className="bg-rowan-bg rounded-lg p-3 mb-3 border border-rowan-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
            <Coins size={18} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-rowan-muted text-xs">Stable value</p>
            <p className="text-rowan-text font-semibold tabular-nums break-all">
              {quote.usdcAmount} USDC
            </p>
          </div>
        </div>
        <p className="text-rowan-muted text-xs mt-2 ml-12">
          ★ Backed by real Stellar network liquidity
        </p>
      </div>

      {/* Arrow to fiat */}
      <div className="flex justify-center mb-3">
        <div className="flex flex-col items-center gap-1">
          <ArrowDown size={16} className="text-rowan-muted animate-pulse" />
          <p className="text-rowan-muted text-xs text-center px-2">
            Converted to fiat
          </p>
        </div>
      </div>

      {/* Step 3: You receive (fiat) */}
      <div className="flex items-center gap-3 pb-4">
        <div className="w-10 h-10 rounded-full bg-rowan-green/20 flex items-center justify-center shrink-0">
          <Smartphone size={20} className="text-rowan-green" />
        </div>
        <div className="flex-1">
          <p className="text-rowan-muted text-xs">You receive</p>
          <p className="text-rowan-green text-xl font-bold tabular-nums">
            {Number(quote.fiatAmount).toLocaleString('en-US', { maximumFractionDigits: 0 })} {quote.currency}
          </p>
        </div>
      </div>

      {/* ── FEES AND DETAILS BREAKDOWN ── */}
      <div className="border-t border-rowan-border mt-4 pt-4">
        <p className="text-rowan-muted text-xs font-semibold mb-2 uppercase tracking-wide">Fees & Details</p>
        
        <div className="space-y-1.5 text-sm">
          <DetailRow 
            label="Network rate" 
            value={`1 XLM = ${quote.currency} ${Number(quote.rate).toLocaleString('en-US', { maximumFractionDigits: 2 })}`}
            tooltip="Current live rate from Stellar DEX"
          />
          <DetailRow 
            label="Slippage protection" 
            value="0.3%"
            tooltip="Price protection on conversion"
          />
          {quote.spread && (
            <DetailRow 
              label="Platform fee" 
              value={`${feePercentage}%`}
              tooltip="Rowan service fee on fiat amount"
            />
          )}
          <DetailRow 
            label="Mobile provider" 
            value={network.label || quote.network}
            tooltip="Where you'll receive the money"
          />
          <DetailRow 
            label="Estimated delivery" 
            value={ESTIMATED_DELIVERY}
            tooltip="Time to receive after trader confirms"
          />
        </div>
      </div>

      {/* ── TRUST BADGE ── */}
      <div className="border-t border-rowan-border mt-3 pt-3">
        <div className="flex items-start gap-2 bg-rowan-bg rounded-lg p-2.5">
          <Zap size={14} className="text-rowan-yellow shrink-0 mt-0.5" />
          <p className="text-rowan-muted text-xs leading-relaxed">
            Powered by <strong>Stellar network liquidity</strong> — transparent, 
            fast, and trustless conversion.
          </p>
        </div>
      </div>

      {/* ── QUOTE IDENTIFIER ── */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-rowan-border/30">
        <Hash size={12} className="text-rowan-muted" />
        <span className="text-rowan-muted text-xs font-mono truncate">
          Quote: {quote.quoteId?.slice(0, 12)}...
        </span>
      </div>

      {/* ── PHONE (masked for privacy) ── */}
      {quote.phone && (
        <div className="text-rowan-muted text-xs mt-2">
          To: {maskPhoneNumber(quote.phone)}
        </div>
      )}
    </div>
  )
}

/**
 * Detail row with optional tooltip indication
 */
function DetailRow({ label, value, tooltip }) {
  return (
    <div className="flex justify-between items-start py-0.5 gap-2">
      <span className="text-rowan-muted text-xs">{label}</span>
      <span className="text-rowan-text text-xs font-medium tabular-nums text-right">
        {value}
      </span>
    </div>
  )
}
