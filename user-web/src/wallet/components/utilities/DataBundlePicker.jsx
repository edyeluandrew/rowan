import { Loader2, Wifi } from 'lucide-react'

function splitPlanLabel(description) {
  const text = String(description || '').trim()
  if (!text) return { title: 'Data plan', detail: null }
  const parts = text.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { title: parts[0], detail: parts.slice(1).join(' · ') }
  }
  return { title: text, detail: null }
}

export default function DataBundlePicker({
  bundles,
  selected,
  onSelect,
  loading,
  currency,
  operatorName,
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-rowan-muted text-sm">
        <Loader2 size={18} className="animate-spin" />
        Loading data plans…
      </div>
    )
  }

  if (!bundles?.length) {
    return (
      <p className="text-rowan-muted text-sm py-4 px-1">
        Enter your phone number above to load live data plans for your network.
      </p>
    )
  }

  return (
    <div>
      {operatorName && (
        <p className="text-rowan-muted text-xs mb-3 px-1 flex items-center gap-1.5">
          <Wifi size={12} className="shrink-0" />
          Plans from {operatorName}
        </p>
      )}
      <div className="space-y-2">
        {bundles.map((bundle) => {
          const key = `${bundle.operatorId || ''}-${bundle.fiatAmount}-${bundle.description}`
          const isSelected = selected?.fiatAmount === bundle.fiatAmount
            && selected?.description === bundle.description
          const bundleCurrency = bundle.fiatCurrency || currency
          const { title, detail } = splitPlanLabel(bundle.description)

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(bundle)}
              className={`w-full text-left rounded-xl border p-4 min-h-11 transition-colors ${
                isSelected
                  ? 'border-rowan-yellow bg-rowan-yellow/10 ring-1 ring-rowan-yellow/30'
                  : 'border-rowan-border bg-rowan-surface hover:border-rowan-yellow/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-rowan-text text-sm font-semibold leading-snug">
                    {title}
                  </p>
                  {detail && (
                    <p className="text-rowan-muted text-xs mt-1 leading-snug">
                      {detail}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-rowan-text text-sm font-bold tabular-nums">
                    {Number(bundle.fiatAmount).toLocaleString()} {bundleCurrency}
                  </p>
                  {isSelected && (
                    <p className="text-rowan-yellow text-[10px] font-medium mt-0.5 uppercase tracking-wide">
                      Selected
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
