/**
 * OTC trader website. Same screens as the phone trader app,
 * kept in a phone-width column so desktop and mobile match.
 */
import { AuthProvider } from '../../../rowan-mobile/src/context/AuthContext'
import TraderWebGate from '../../../rowan-mobile/src/trader/TraderWebGate'

export default function TraderWeb() {
  return (
    <div className="trader-web-root min-h-[100dvh] bg-rowan-bg text-rowan-text">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] min-[431px]:shadow-[0_0_0_1px_#2B3139]">
        <AuthProvider mode="trader">
          <TraderWebGate />
        </AuthProvider>
      </div>
    </div>
  )
}
