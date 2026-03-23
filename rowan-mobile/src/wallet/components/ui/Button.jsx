import { RefreshCw } from 'lucide-react'

/**
 * Primary button component with loading state.
 */
export default function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary',
  className = '',
  type = 'button',
}) {
  const base = 'flex items-center justify-center gap-2 font-bold rounded-xl py-4 w-full text-base transition-opacity min-h-11'

  const variants = {
    primary: 'bg-rowan-yellow text-rowan-bg',
    ghost: 'bg-transparent border border-rowan-border text-rowan-muted',
    danger: 'bg-transparent border border-rowan-red text-rowan-red',
  }

  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${base} ${variants[variant] || variants.primary} ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:opacity-80'
      } ${className}`}
    >
      {loading ? <RefreshCw size={18} className="animate-spin" /> : children}
    </button>
  )
}
