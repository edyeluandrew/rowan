import { RefreshCw } from 'lucide-react'

/**
 * Primary button — brand green CTA.
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
  const base =
    'flex items-center justify-center gap-2 font-semibold rounded-2xl py-3.5 sm:py-4 w-full text-base transition-all min-h-12 font-sans'

  const variants = {
    primary:
      'bg-rowan-green text-white shadow-[0_8px_24px_rgba(18,184,26,0.22)] active:bg-rowan-green-dark hover:brightness-105',
    ghost: 'bg-transparent border border-rowan-border text-rowan-muted hover:bg-rowan-mint/40',
    danger: 'bg-transparent border border-rowan-red text-rowan-red',
  }

  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${base} ${variants[variant] || variants.primary} ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.99]'
      } ${className}`}
    >
      {loading ? <RefreshCw size={18} className="animate-spin" /> : children}
    </button>
  )
}
