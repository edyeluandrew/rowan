import { RefreshCw, Store } from 'lucide-react'
import Button from '../ui/Button'

/**
 * Empty P2P list — launch vs filter miss, so an empty market does not look broken.
 */
export default function MarketplaceEmpty({ tab = 'buy', filtered = false, onRefresh, onClearFilters }) {
  const side = tab === 'buy' ? 'Buy' : 'Sell'

  if (filtered) {
    return (
      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-8 text-center">
        <Store size={28} className="text-rowan-muted mx-auto mb-3" />
        <p className="text-rowan-text text-sm font-medium">No traders for these filters</p>
        <p className="text-rowan-muted text-xs mt-2 leading-relaxed">
          Try All payments, a different amount, or check back in a bit.
        </p>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          {onClearFilters && (
            <Button variant="ghost" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
          <Button variant="ghost" onClick={onRefresh}>
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-8 text-center">
      <Store size={28} className="text-rowan-muted mx-auto mb-3" />
      <p className="text-rowan-text text-sm font-medium">No traders online yet</p>
      <p className="text-rowan-muted text-xs mt-2 leading-relaxed">
        {side} USDC uses local MTN and Airtel traders. The list is empty while we onboard them — this is not a failed load.
        Airtime, data and bills from Home still work.
      </p>
      <Button className="mt-4" variant="ghost" onClick={onRefresh}>
        <RefreshCw size={16} />
        Refresh
      </Button>
    </div>
  )
}
