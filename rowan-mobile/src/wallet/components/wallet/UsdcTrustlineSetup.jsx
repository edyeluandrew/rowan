import { useState } from 'react'
import { AlertTriangle, Coins } from 'lucide-react'
import Button from '../ui/Button'
import { getSecure } from '../../utils/storage'
import { provisionUsdcWallet, fundTestUsdcWallet } from '../../utils/stellar'
import { CURRENT_NETWORK } from '../../utils/constants'
import useWallet from '../../hooks/useWallet'

/**
 * Fallback retry when automatic USDC trustline setup did not complete.
 */
export default function UsdcTrustlineSetup({ onEnabled, compact = false }) {
  const { hasUsdcTrustline, refresh, publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (hasUsdcTrustline === true || success) return null

  const handleRetry = async () => {
    setLoading(true)
    setError(null)
    try {
      const stored = await getSecure('rowan_stellar_keypair')
      if (!stored) throw new Error('Wallet not found. Please re-import your wallet.')
      const kp = JSON.parse(stored)
      if (!kp.secretKey) throw new Error('Wallet key data is corrupted. Please re-import your wallet.')

      const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL
      const result = CURRENT_NETWORK.isTest
        ? await fundTestUsdcWallet({
            secretKey: kp.secretKey,
            publicKey: kp.publicKey || publicKey,
            horizonUrl,
          })
        : await provisionUsdcWallet({
            secretKey: kp.secretKey,
            publicKey: kp.publicKey || publicKey,
            horizonUrl,
          })
      if (result.skipped === 'account_not_funded') {
        throw new Error('Wallet needs a small XLM balance before USDC can be enabled.')
      }
      setSuccess(true)
      await refresh()
      onEnabled?.()
    } catch (err) {
      setError(err.message || 'Could not finish USDC setup')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
        <p className="text-rowan-text text-sm font-medium">Finishing USDC setup</p>
        <p className="text-rowan-muted text-xs mt-1">
          Your wallet is still being prepared to receive USDC.
        </p>
        {error && <p className="text-rowan-red text-xs mt-2">{error}</p>}
        <Button className="w-full mt-3" size="sm" loading={loading} onClick={handleRetry}>
          Retry USDC setup
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <Coins size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-rowan-text text-sm font-semibold">Finishing USDC setup</p>
          <p className="text-rowan-muted text-xs mt-1">
            Rowan sets up USDC automatically. If this is taking longer than expected, tap retry.
          </p>
          {error && (
            <div className="flex items-start gap-2 mt-2">
              <AlertTriangle size={14} className="text-rowan-yellow shrink-0 mt-0.5" />
              <p className="text-rowan-red text-xs">{error}</p>
            </div>
          )}
          <Button className="w-full mt-3" size="sm" loading={loading} onClick={handleRetry}>
            Retry USDC setup
          </Button>
        </div>
      </div>
    </div>
  )
}
