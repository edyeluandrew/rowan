import { AlertTriangle } from 'lucide-react'
import useCountdown from '../../hooks/useCountdown'

const WARNING_THRESHOLD_SECONDS = 120

/**
 * Large centered payment window countdown after trader match.
 */
export default function PaymentWindowCountdown({ expiresAt, orderSide = 'SELL' }) {
  const { formatted, isExpired, remaining } = useCountdown(expiresAt)
  const showWarning = remaining > 0 && remaining <= WARNING_THRESHOLD_SECONDS
  const isBuy = orderSide === 'BUY'

  if (!expiresAt) return null

  if (isExpired) {
    return (
      <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-6 mb-4 text-center">
        <p className="text-rowan-red text-sm font-semibold">Time window expired</p>
        <p className="text-rowan-muted text-xs mt-2">
          {isBuy
            ? 'This order may be cancelled if the trader did not lock USDC in time.'
            : 'Your XLM will be refunded if the trader did not send mobile money in time.'}
        </p>
      </div>
    )
  }

  const label = showWarning
    ? 'Time window closing soon'
    : isBuy
      ? 'Waiting for trader to lock USDC'
      : 'Awaiting payment from trader'

  return (
    <div
      className={`rounded-xl p-6 mb-4 border text-center ${
        showWarning
          ? 'bg-rowan-red/10 border-rowan-red/30'
          : 'bg-rowan-surface border-rowan-border'
      }`}
    >
      <p className={`text-sm font-medium mb-3 ${showWarning ? 'text-rowan-red' : 'text-rowan-muted'}`}>
        {label}
      </p>
      <p
        className={`font-mono text-4xl font-bold tabular-nums tracking-wider ${
          showWarning ? 'text-rowan-red' : 'text-rowan-yellow'
        }`}
      >
        {formatted}
      </p>
      {showWarning && (
        <div className="flex items-start justify-center gap-2 mt-4">
          <AlertTriangle size={14} className="text-rowan-red shrink-0 mt-0.5" />
          <p className="text-rowan-red text-xs max-w-xs">
            {isBuy
              ? 'If USDC is not locked soon, this order may be reassigned or cancelled.'
              : 'If mobile money does not arrive soon, your order may be refunded automatically.'}
          </p>
        </div>
      )}
    </div>
  )
}
