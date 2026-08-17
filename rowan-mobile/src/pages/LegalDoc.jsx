/**
 * In-app Terms / Privacy. Keep markdown in sync with docs/legal/03 and 04.
 */
import { Link, Navigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth, ROLE_TRADER } from '../context/AuthContext'
import terms from '../legal/terms.md?raw'
import privacy from '../legal/privacy.md?raw'

const DOCS = {
  terms: { title: 'Terms of Service', body: terms },
  privacy: { title: 'Privacy Policy', body: privacy },
}

export default function LegalDoc() {
  const { doc } = useParams()
  const { isAuthenticated, role } = useAuth()
  const entry = DOCS[doc]
  if (!entry) return <Navigate to="/" replace />

  const backTo = isAuthenticated
    ? (role === ROLE_TRADER ? '/trader/home' : '/wallet/help')
    : '/'

  return (
    <main className="min-h-[100dvh] bg-rowan-bg text-rowan-text pb-10">
      <header className="flex items-center gap-2 px-4 pt-6 pb-3">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm text-rowan-muted min-h-11"
        >
          <ChevronLeft size={18} />
          Back
        </Link>
      </header>
      <article className="px-4">
        <h1 className="text-lg font-bold mb-4">{entry.title}</h1>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-rowan-text">
          {entry.body}
        </pre>
      </article>
    </main>
  )
}
