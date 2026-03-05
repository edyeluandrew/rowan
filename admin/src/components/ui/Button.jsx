import { RefreshCw } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-rowan-yellow text-rowan-bg hover:bg-rowan-yellow/90',
  ghost: 'border border-rowan-border text-rowan-muted hover:text-rowan-text hover:bg-rowan-border/30',
  danger: 'bg-rowan-red/20 border border-rowan-red/30 text-rowan-red hover:bg-rowan-red/30',
  success: 'bg-rowan-green/20 border border-rowan-green/30 text-rowan-green hover:bg-rowan-green/30',
}

export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-xl px-4 py-2.5 font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${className}`}
      {...props}
    >
      {loading && <RefreshCw size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
