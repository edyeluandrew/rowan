import { Check, Copy } from 'lucide-react'

/**
 * One-job cash-out hero: big amount + what to do now.
 */
export default function TradeNowHero({
  step,
  steps = 4,
  title,
  amountLabel,
  amountCaption,
  onCopyAmount,
  copied = false,
}) {
  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5 mb-4 text-center">
      {step != null && (
        <p className="text-rowan-muted text-[11px] uppercase tracking-wider mb-2">
          Step {step} of {steps}
        </p>
      )}
      <p className="text-rowan-text text-lg font-bold">{title}</p>
      {amountLabel && (
        <p className="text-rowan-green text-4xl font-bold tabular-nums mt-3 leading-tight">
          {amountLabel}
        </p>
      )}
      {amountCaption && (
        <p className="text-rowan-muted text-sm mt-2">{amountCaption}</p>
      )}
      {onCopyAmount && amountLabel && (
        <button
          type="button"
          onClick={onCopyAmount}
          className="inline-flex items-center gap-1.5 mt-3 text-rowan-yellow text-xs font-medium min-h-9 px-3 rounded-full border border-rowan-yellow/40"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy amount'}
        </button>
      )}
    </div>
  )
}
