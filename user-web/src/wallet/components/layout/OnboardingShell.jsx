/**
 * Shared chrome for wallet setup steps — simple, responsive card layout.
 */
import { ProgressDots, TrustLine } from '../onboarding/OnboardingBits'

export default function OnboardingShell({
  children,
  step,
  stepTotal = 3,
  title,
  subtitle,
  className = '',
  wide = false,
}) {
  return (
    <div className={`min-h-[100dvh] overflow-y-auto bg-rowan-bg text-rowan-text ${className}`}>
      {/* Soft brand wash */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(18,184,26,0.12),transparent_55%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 sm:px-6 py-6 sm:py-10">
        <header className="safe-top mb-6 sm:mb-8 flex items-center justify-between">
          <p className="font-serif text-xl sm:text-2xl text-rowan-green tracking-tight">Rowan</p>
          {step != null && (
            <span className="text-xs text-rowan-muted font-sans tabular-nums">
              Step {step} of {stepTotal}
            </span>
          )}
        </header>

        {step != null && (
          <ProgressDots current={step} total={stepTotal} className="mb-6 sm:mb-8" />
        )}

        {(title || subtitle) && (
          <div className={`mb-6 sm:mb-8 ${wide ? 'text-left' : 'text-center sm:text-left'}`}>
            {title && (
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-rowan-text leading-tight tracking-tight">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 sm:mt-3 text-sm sm:text-base text-rowan-muted leading-relaxed font-sans max-w-md mx-auto sm:mx-0">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div
          className={`flex-1 rounded-3xl bg-white border border-rowan-border/90 shadow-[0_12px_40px_rgba(11,15,12,0.06)] p-5 sm:p-7 md:p-8 ${wide ? '' : ''}`}
        >
          {children}
        </div>

        <div className="mt-6 sm:mt-8 pb-2 safe-bottom">
          <TrustLine />
        </div>
      </div>
    </div>
  )
}
