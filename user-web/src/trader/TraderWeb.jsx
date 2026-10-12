/**
 * OTC trader website. Fills the screen and grows with the window.
 */
import { AuthProvider } from '../../../rowan-mobile/src/context/AuthContext'
import TraderWebGate from '../../../rowan-mobile/src/trader/TraderWebGate'

export default function TraderWeb() {
  return (
    <div className="trader-web-root min-h-[100dvh] w-full bg-rowan-bg text-rowan-text">
      <AuthProvider mode="trader">
        <TraderWebGate />
      </AuthProvider>
    </div>
  )
}
