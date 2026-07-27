import { Loader2 } from 'lucide-react'

function ServiceBadge({ serviceType }) {
  if (!serviceType) return null
  return (
    <span className="text-[10px] uppercase tracking-wide font-semibold text-rowan-purple bg-rowan-purple/15 px-2 py-0.5 rounded-full">
      {serviceType}
    </span>
  )
}

export default function BillerPicker({ billers, selected, onSelect, loading, country }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-rowan-muted text-sm">
        <Loader2 size={18} className="animate-spin" />
        Loading bill providers…
      </div>
    )
  }

  if (!billers?.length) {
    return (
      <p className="text-rowan-muted text-sm py-4 px-1">
        No bill providers available for {country || 'this country'} yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {billers.map((biller) => {
        const isSelected = selected?.id === biller.id
        return (
          <button
            key={biller.id}
            type="button"
            onClick={() => onSelect(biller)}
            className={`w-full text-left rounded-xl border p-4 min-h-11 transition-colors ${
              isSelected
                ? 'border-rowan-yellow bg-rowan-yellow/10'
                : 'border-rowan-border bg-rowan-surface'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-rowan-text text-sm font-semibold leading-snug">
                  {biller.name}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-rowan-muted text-xs">{biller.countryCode}</span>
                  <ServiceBadge serviceType={biller.serviceType} />
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${
                  isSelected ? 'border-rowan-yellow bg-rowan-yellow' : 'border-rowan-border'
                }`}
              />
            </div>
            {biller.minAmount != null && biller.maxAmount != null && (
              <p className="text-rowan-muted text-xs mt-2 tabular-nums">
                {Number(biller.minAmount).toLocaleString()} – {Number(biller.maxAmount).toLocaleString()} {biller.currency}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
