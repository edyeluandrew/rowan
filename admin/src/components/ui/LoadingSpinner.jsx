import { RefreshCw } from 'lucide-react'

export default function LoadingSpinner({ size = 20, className = '' }) {
  return <RefreshCw size={size} className={`animate-spin text-rowan-muted ${className}`} />
}
