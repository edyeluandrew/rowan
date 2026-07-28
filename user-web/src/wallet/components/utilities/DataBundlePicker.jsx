import { Loader2 } from 'lucide-react'

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
        Enter your phone number above to see available data bundles.
      </p>
    )
  }

  return (
    <div>
      {operatorName && (
        <p className="text-rowan-muted text-xs mb-3 px-1">
          Plans from {operatorName}
        </p>
      )}
      <div className="space-y-2">
        {bundles.map((bundle) => {
          const key = `${bundle.fiatAmount}-${bundle.description}`
          const isSelected = selected?.fiatAmount === bundle.fiatAmount
            && selected?.description === bundle.description
          const bundleCurrency = bundle.fiatCurrency || currency

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(bundle)}
              className={`w-full text-left rounded-xl border p-4 min-h-11 transition-colors ${
                isSelected
                  ? 'border-rowan-yellow bg-rowan-yellow/10'
                  : 'border-rowan-border bg-rowan-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-rowan-text text-sm font-semibold leading-snug">
                    {bundle.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-rowan-text text-sm font-bold tabular-nums">
                    {Number(bundle.fiatAmount).toLocaleString()} {bundleCurrency}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
