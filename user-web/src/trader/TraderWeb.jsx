/**
 * OTC trader website. The trader shell fills the window.
 * This is separate from the customer wallet on rowanpay.app.
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
