import { ArrowLeftRight, Shield, Smartphone, Wallet } from 'lucide-react'

/** Feature cards for landing (Lucide icons only). */
export function FeatureGrid({ className = '' }) {
  const items = [
    { Icon: Wallet, label: 'USDC wallet', hint: 'Hold dollars on Stellar' },
    { Icon: ArrowLeftRight, label: 'Buy & sell', hint: 'Match traders live' },
    { Icon: Smartphone, label: 'Mobile money', hint: 'MTN, Airtel & more' },
    { Icon: Shield, label: 'Escrow safe', hint: 'Confirm before release' },
  ]

  return (
    <div className={`grid grid-cols-2 gap-2.5 sm:gap-3 ${className}`}>
      {items.map(({ Icon, label, hint }) => (
        <div
          key={label}
          className="rounded-2xl bg-white/90 border border-rowan-border/80 px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-rowan-mint flex items-center justify-center mb-2">
            <Icon size={18} className="text-rowan-green" strokeWidth={2} />
          </div>
          <p className="text-sm font-semibold text-rowan-text font-sans">{label}</p>
          <p className="text-xs text-rowan-muted mt-0.5 font-sans leading-snug">{hint}</p>
        </div>
      ))}
    </div>
  )
}

export function ProgressDots({ current = 1, total = 3, className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i + 1 === current
              ? 'w-6 bg-rowan-green'
              : i + 1 < current
                ? 'w-1.5 bg-rowan-green/50'
                : 'w-1.5 bg-rowan-border'
          }`}
        />
      ))}
    </div>
  )
}

export function TrustLine({ children = 'Keys stay on your device · never uploaded' }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-rowan-muted">
      <Shield size={13} className="text-rowan-green shrink-0" />
      <p className="text-[11px] sm:text-xs font-sans text-center leading-snug">{children}</p>
    </div>
  )
}
