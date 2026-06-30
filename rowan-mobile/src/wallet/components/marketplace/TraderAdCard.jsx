import { ShieldCheck, Clock } from 'lucide-react'
import {
  formatCurrency,
  formatPercent,
  formatDurationMinutes,
  formatXlmRateLine,
  formatUsdcRateLine,
  getTraderDisplayName,
} from '../../utils/p2pFormat'
import PaymentMethodPill from '../ui/PaymentMethodPill'
import Button from '../ui/Button'

export default function TraderAdCard({ ad, xlmRate, mode = 'sell', onTrade, onViewProfile, tradeDisabled = false }) {
  const isBuy = mode === 'buy'
  const rateLine = isBuy
    ? formatUsdcRateLine(ad.currency, ad.ratePerUsdc)
    : formatXlmRateLine(ad.currency, xlmRate)
  const completion = formatPercent(ad.completionRate)
  const releaseTime = formatDurationMinutes(ad.avgReleaseMinutes)
  const replyTime = formatDurationMinutes(ad.avgResponseMinutes)
  const isVerified = ad.trustScore >= 80
  const availableUsdc = ad.availableUsdc ?? ad.available_usdc

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-rowan-text font-semibold text-base truncate">
              {getTraderDisplayName(ad.traderName)}
            </span>
            {ad.isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-rowan-green text-xs font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" aria-hidden />
                Online
              </span>
            ) : ad.lastSeenLabel ? (
              <span className="inline-flex items-center gap-1.5 text-rowan-muted text-xs">
                <span className="w-2 h-2 rounded-full bg-rowan-muted/60 shrink-0" aria-hidden />
                {ad.lastSeenLabel}
              </span>
            ) : null}
            {isVerified && (
              <ShieldCheck size={16} className="text-rowan-green shrink-0" aria-label="Verified trader" />
            )}
          </div>
          {rateLine && (
            <p className="text-rowan-yellow text-sm font-medium mt-1">{rateLine}</p>
          )}
          {!isBuy && !rateLine && (
            <p className="text-rowan-muted text-sm mt-1">Live market rate at quote</p>
          )}
          {isBuy && !rateLine && (
            <p className="text-rowan-muted text-xs mt-1">Trader has not set a USDC price on this ad</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <PaymentMethodPill network={ad.network} />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {completion && (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-green/15 text-rowan-green">
            {completion} completion
          </span>
        )}
        {releaseTime && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-surface border border-rowan-border text-rowan-muted">
            <Clock size={12} className="shrink-0" />
            Avg. {releaseTime}
          </span>
        )}
        {replyTime && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-surface border border-rowan-border text-rowan-muted">
            <Clock size={12} className="shrink-0" />
            Avg. reply: {replyTime}
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-rowan-text text-sm font-medium">
          Limits: {formatCurrency(ad.minAmount, ad.currency)}
          {' \u2013 '}
          {formatCurrency(ad.maxAmount, ad.currency)}
        </p>
        {isBuy && availableUsdc != null && (
          <p className="text-rowan-muted text-xs">
            {Number(availableUsdc).toFixed(2)} USDC available
          </p>
        )}
        {!isBuy && ad.availableFloat != null && (
          <p className="text-rowan-muted text-xs">
            {formatCurrency(ad.availableFloat, ad.currency)} float available
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" className="py-3" onClick={() => onViewProfile?.(ad)}>
          View profile
        </Button>
        <Button className="py-3" onClick={() => onTrade?.(ad)} disabled={tradeDisabled || (isBuy && !ad.ratePerUsdc)}>
          {isBuy ? 'Buy USDC' : 'Trade'}
        </Button>
      </div>
    </div>
  )
}
