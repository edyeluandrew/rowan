/**
 * Public Terms / Privacy pages. Keep markdown in sync with docs/legal/03 and 04.
 */
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth, ROLE_WALLET } from '../context/AuthContext'
import RowanLogo from '../components/RowanLogo'
import terms from '../legal/terms.md?raw'
import privacy from '../legal/privacy.md?raw'

const DOCS = {
  terms: {
    title: 'Terms of Service',
    description: 'Rowan user terms for the wallet, P2P buy and sell, and utility payments.',
    body: terms,
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How Rowan collects, uses, and shares personal data.',
    body: privacy,
  },
}

export default function LegalDoc() {
  const { doc } = useParams()
  const { isAuthenticated, role } = useAuth()
  const entry = DOCS[doc]
  if (!entry) return <Navigate to="/" replace />

  const home = isAuthenticated && role === ROLE_WALLET ? '/wallet/home' : '/'

  return (
    <main className="min-h-[100dvh] bg-rowan-bg text-rowan-text">
      <header className="border-b border-rowan-border/70 bg-white/80">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-3.5 sm:px-8">
          <Link
            to={home}
            className="inline-flex items-center gap-1 text-sm text-rowan-muted hover:text-rowan-text font-sans min-h-11"
          >
            <ChevronLeft size={18} />
            Back
          </Link>
          <Link to={home} aria-label="Rowan home" className="ml-auto">
            <RowanLogo size={28} />
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 pb-16">
        <p className="text-xs uppercase tracking-[0.14em] text-rowan-muted font-sans">Legal</p>
        <h1 className="mt-2 font-serif text-3xl text-rowan-text tracking-tight">{entry.title}</h1>
        <p className="mt-2 text-sm text-rowan-muted font-sans">{entry.description}</p>
        <pre className="mt-8 whitespace-pre-wrap font-sans text-sm leading-relaxed text-rowan-text">
          {entry.body}
        </pre>
      </article>
    </main>
  )
}
