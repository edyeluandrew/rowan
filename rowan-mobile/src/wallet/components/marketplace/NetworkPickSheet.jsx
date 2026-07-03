import PaymentMethodPill from '../ui/PaymentMethodPill'
import Button from '../ui/Button'

/**
 * Bottom sheet — pick which MoMo network when a trader has multiple offers.
 */
export default function NetworkPickSheet({
  open,
  traderName,
  offers = [],
  mode = 'sell',
  onSelect,
  onClose,
}) {
  if (!open) return null

  const title = mode === 'buy' ? `Buy USDC from ${traderName}` : `Sell to ${traderName}`

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-rowan-surface rounded-t-2xl p-6 w-full max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-rowan-border rounded-full mx-auto mb-5" />
        <h3 className="text-rowan-text font-bold text-lg">{title}</h3>
        <p className="text-rowan-muted text-sm mt-2 mb-5">
          Choose how you want to {mode === 'buy' ? 'pay' : 'receive'} mobile money.
        </p>
        <div className="space-y-2">
          {offers.map((offer) => (
            <button
              key={offer.payoutSettingId}
              type="button"
              onClick={() => onSelect(offer)}
              className="w-full flex items-center justify-between gap-3 bg-rowan-bg border border-rowan-border rounded-xl px-4 py-3 min-h-12 hover:border-rowan-yellow/50"
            >
              <PaymentMethodPill network={offer.network} />
              <span className="text-rowan-muted text-xs shrink-0">Tap to continue</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
