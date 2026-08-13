import { Link } from 'react-router-dom'

/**
 * Public 404 — branded, no soft-redirect to homepage for unknown URLs.
 */
export default function NotFound() {
  return (
    <main className="min-h-[100dvh] bg-rowan-bg text-rowan-text flex flex-col items-center justify-center px-5 py-16">
      <p className="font-serif text-4xl text-rowan-green tracking-tight">Rowan</p>
      <h1 className="mt-6 font-serif text-2xl sm:text-3xl text-center">Page not found</h1>
      <p className="mt-3 text-sm text-rowan-muted text-center max-w-sm font-sans leading-relaxed">
        That link does not exist on the Rowan public site. Head home to open or create your wallet.
      </p>
      <Link
        to="/"
        className="mt-8 min-h-12 px-6 rounded-2xl bg-rowan-green text-white font-semibold inline-flex items-center justify-center"
      >
        Back to homepage
      </Link>
    </main>
  )
}
