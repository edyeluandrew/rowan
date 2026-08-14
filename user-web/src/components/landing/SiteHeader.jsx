/** Sticky site nav for the public landing page. */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, ArrowRight } from 'lucide-react'
import RowanLogo from '../RowanLogo'

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#bills', label: 'Bills' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
]

export default function SiteHeader({ ctaLabel, onCta }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? 'bg-rowan-bg/85 backdrop-blur-md border-b border-rowan-border/70' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8 lg:px-12">
        <Link
          to="/"
          aria-label="Rowan home"
          className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-rowan-green"
        >
          <RowanLogo size={34} />
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-7">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-sans text-rowan-muted hover:text-rowan-text transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCta}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-rowan-green px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(18,184,26,0.24)] transition active:scale-[0.98]"
          >
            {ctaLabel}
            <ArrowRight size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="lg:hidden w-10 h-10 rounded-full border border-rowan-border bg-white flex items-center justify-center"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-rowan-border/70 bg-rowan-bg/95 backdrop-blur-md">
          <nav aria-label="Mobile" className="mx-auto w-full max-w-6xl px-5 py-3 sm:px-8">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-sm font-sans text-rowan-text border-b border-rowan-border/50 last:border-0"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onCta?.()
              }}
              className="mt-3 mb-1 w-full rounded-2xl bg-rowan-green py-3 text-sm font-semibold text-white"
            >
              {ctaLabel}
            </button>
          </nav>
        </div>
      )}
    </header>
  )
}
