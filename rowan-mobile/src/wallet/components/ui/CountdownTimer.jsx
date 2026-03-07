import { useEffect, useRef } from 'react'
import { Timer } from 'lucide-react'
import useCountdown from '../../hooks/useCountdown'

/**
 * Visual countdown timer that shows time remaining until expiry.
 * Calls onExpire exactly once when the countdown reaches zero.
 */
export default function CountdownTimer({ expiresAt, onExpire, className = '' }) {
  const { formatted, isExpired } = useCountdown(expiresAt)
  const hasCalledExpire = useRef(false)

  useEffect(() => {
    if (isExpired && onExpire && !hasCalledExpire.current) {
      hasCalledExpire.current = true
      onExpire()
    }
  }, [isExpired, onExpire])

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Timer size={16} className={isExpired ? 'text-rowan-red' : 'text-rowan-muted'} />
      <span
        className={`text-sm font-mono tabular-nums ${
          isExpired ? 'text-rowan-red' : 'text-rowan-muted'
        }`}
      >
        {isExpired ? 'Expired' : formatted}
      </span>
    </div>
  )
}
