import { FLOAT_WARNING_THRESHOLD } from '../../../shared/utils/constants'
import { formatCurrency } from '../../../shared/utils/format'

export default function FloatBar({ current = 0, limit = 1 }) {
  const pct = limit > 0 ? Math.min((current / limit) * 100, 100) : 0
  const isLow = current < FLOAT_WARNING_THRESHOLD

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className={isLow ? 'text-rowan-red' : 'text-rowan-muted'}>{formatCurrency(current)}</span>
        <span className="text-rowan-muted">{formatCurrency(limit)}</span>
      </div>
      <div className="h-1.5 bg-rowan-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isLow ? 'bg-rowan-red' : 'bg-rowan-green'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
