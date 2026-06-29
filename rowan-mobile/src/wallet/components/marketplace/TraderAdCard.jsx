import { ShieldCheck } from 'lucide-react'
import {
  formatCurrency,
  formatPercent,
  formatDurationMinutes,
  formatXlmRateLine,
  getTraderDisplayName,
} from '../../utils/p2pFormat'
import PaymentMethodPill from '../ui/PaymentMethodPill'
import Button from '../ui/Button'

export default function TraderAdCard({ ad, xlmRate, onTrade, onViewProfile }) {
  const rateLine = formatXlmRateLine(ad.currency, xlmRate)
  const completion = formatPercent(ad.completionRate)
  const releaseTime = formatDurationMinutes(ad.avgReleaseMinutes)
  const isVerified = ad.trustScore >= 80

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-rowan-text font-semibold text-base truncate">
              {getTraderDisplayName(ad.traderName)}
            </span>
            {isVerified && (
              <ShieldCheck size={16} className="text-rowan-green shrink-0" aria-label="Verified trader" />
            )}
          </div>
          {rateLine && (
            <p className="text-rowan-muted text-sm mt-1">{rateLine}</p>
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
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-rowan-surface border border-rowan-border text-rowan-muted">
            Avg. {releaseTime}
          </span>
        )}
      </div>

      <p className="text-rowan-text text-sm font-medium mt-3">
        {formatCurrency(ad.minAmount, ad.currency)}
        {' \u2013 '}
        {formatCurrency(ad.maxAmount, ad.currency)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" className="py-3" onClick={() => onViewProfile?.(ad)}>
          View profile
        </Button>
        <Button className="py-3" onClick={() => onTrade?.(ad)}>
          Trade
        </Button>
      </div>
    </div>
  )
}
