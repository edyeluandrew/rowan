import { ArrowLeftRight } from 'lucide-react'
import { NETWORKS } from '../../utils/constants'
import Badge from '../ui/Badge'

/**
 * Displays live exchange rates for all supported networks.
 */
export default function RateDisplay({ allRates, loading }) {
  if (loading || !allRates) {
    return (
      <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
        <p className="text-rowan-muted text-sm text-center py-4">Loading rates...</p>
      </div>
    )
  }

  const rateEntries = Array.isArray(allRates)
    ? allRates
        .filter((r) => NETWORKS[r.network])
        .map((r) => [r.network, r.rate ?? r.price ?? r])
    : Object.entries(allRates).filter(([key]) => NETWORKS[key])

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4">
      <h3 className="text-rowan-text font-bold text-sm mb-3 flex items-center gap-2">
        <ArrowLeftRight size={14} className="text-rowan-yellow" />
        Live Rates
      </h3>
      <div className="divide-y divide-rowan-border">
        {rateEntries.map(([key, rate]) => {
          const network = NETWORKS[key]
          return (
            <div key={key} className="flex justify-between items-center py-2">
              <Badge color={network.color} bg={network.bg}>
                {network.label}
              </Badge>
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={14} className="text-rowan-muted" />
                <span className="text-rowan-yellow font-bold tabular-nums text-sm">
                  {network.currency}{' '}
                  {Number(rate).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
