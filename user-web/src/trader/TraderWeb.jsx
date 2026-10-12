/**
 * OTC trader website. Full width on a phone, a wider column on a larger screen.
 */
import { AuthProvider } from '../../../rowan-mobile/src/context/AuthContext'
import TraderWebGate from '../../../rowan-mobile/src/trader/TraderWebGate'

export default function TraderWeb() {
  return (
    <div className="trader-web-root min-h-[100dvh] w-full bg-rowan-bg text-rowan-text">
      <div className="mx-auto min-h-[100dvh] w-full max-w-3xl">
        <AuthProvider mode="trader">
          <TraderWebGate />
        </AuthProvider>
      </div>
    </div>
  )
}
