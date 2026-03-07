import { RefreshCw } from 'lucide-react'

/**
 * Spinning loader with configurable size and color.
 */
export default function LoadingSpinner({ size = 24, className = 'text-rowan-yellow' }) {
  return <RefreshCw size={size} className={`animate-spin ${className}`} />
}
