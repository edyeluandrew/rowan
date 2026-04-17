import { useEffect, useRef } from 'react'
import { Timer, AlertCircle } from 'lucide-react'
import useCountdown from '../../hooks/useCountdown'

/**
 * [PHASE 3] Enhanced visual countdown timer with warning state.
 * 
 * Shows time remaining until expiry with:
 * - Normal state: grey (>10 seconds)
 * - Warning state: yellow (≤10 seconds)
 * - Expired: red
 * 
 * Calls onExpire exactly once when the countdown reaches zero.
 */
export default function CountdownTimer({ expiresAt, onExpire, className = '' }) {
  const { remaining, isExpired, formatted } = useCountdown(expiresAt)
  const hasCalledExpire = useRef(false)

  useEffect(() => {
    if (isExpired && onExpire && !hasCalledExpire.current) {
      hasCalledExpire.current = true
      onExpire()
    }
  }, [isExpired, onExpire])

  // Determine visual state based on remaining time
  const isUrgent = remaining > 0 && remaining <= 10
  const timerColor = isExpired ? 'text-rowan-red' : isUrgent ? 'text-rowan-yellow' : 'text-rowan-muted'
  const iconComponent = isUrgent && !isExpired ? AlertCircle : Timer

  const IconComponent = iconComponent

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <IconComponent size={16} className={timerColor} />
      <span
        className={`text-sm font-mono tabular-nums font-medium transition-colors ${timerColor}`}
      >
        {isExpired ? 'Expired' : formatted}
      </span>
      {isUrgent && !isExpired && (
        <span className="text-rowan-yellow text-xs ml-1 animate-pulse">
          Expiring soon
        </span>
      )}
    </div>
  )
}
