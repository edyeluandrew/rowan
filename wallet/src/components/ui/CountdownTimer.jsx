import { Timer } from 'lucide-react'
import useCountdown from '../../hooks/useCountdown'

/**
 * Visual countdown timer that shows time remaining until expiry.
 */
export default function CountdownTimer({ expiresAt, className = '' }) {
  const { formatted, isExpired } = useCountdown(expiresAt)

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
