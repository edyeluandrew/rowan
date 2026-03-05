import { Trash2, BellRing, BellOff, TrendingUp, TrendingDown } from 'lucide-react'
import { ALERT_DIRECTIONS } from '../../utils/constants'
import { formatCurrency } from '../../utils/format'

/**
 * Single rate alert card with toggle and delete actions.
 */
export default function RateAlertCard({ alert, currentRate, onToggle, onDelete }) {
  const isAbove = alert.direction === 'ABOVE'
  const Icon = isAbove ? TrendingUp : TrendingDown
  const directionLabel = ALERT_DIRECTIONS[alert.direction]?.label || alert.direction

  // Progress toward target
  const progress = currentRate && alert.targetRate
    ? isAbove
      ? Math.min((currentRate / alert.targetRate) * 100, 100)
      : Math.min((alert.targetRate / currentRate) * 100, 100)
    : 0

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`mt-0.5 ${isAbove ? 'text-rowan-green' : 'text-rowan-red'}`}>
            <Icon size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-rowan-text text-sm font-medium">{alert.pair}</p>
            <p className="text-rowan-muted text-xs mt-0.5">
              {directionLabel} {formatCurrency(alert.targetRate, alert.pair?.split('/')[1] || '')}
            </p>
            {currentRate != null && (
              <p className="text-rowan-muted text-xs mt-1">
                Current: {formatCurrency(currentRate, alert.pair?.split('/')[1] || '')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(alert.id)}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          >
            {alert.active !== false ? (
              <BellRing size={18} className="text-rowan-yellow" />
            ) : (
              <BellOff size={18} />
            )}
          </button>
          <button
            onClick={() => onDelete(alert.id)}
            className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {alert.active !== false && progress > 0 && (
        <div className="mt-3 bg-rowan-bg rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isAbove ? 'bg-rowan-green' : 'bg-rowan-red'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
