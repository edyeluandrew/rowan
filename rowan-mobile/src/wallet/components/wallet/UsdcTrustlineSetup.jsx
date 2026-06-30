import { useState } from 'react'
import { AlertTriangle, Coins } from 'lucide-react'
import Button from '../ui/Button'
import { getSecure } from '../../utils/storage'
import { addUsdcTrustline } from '../../utils/stellar'
import { fundWithFriendbot } from '../../utils/friendbot'
import { CURRENT_NETWORK } from '../../utils/constants'
import useWallet from '../../hooks/useWallet'

/**
 * One-tap USDC trustline setup so the wallet can receive USDC from P2P buy.
 */
export default function UsdcTrustlineSetup({ onEnabled, compact = false }) {
  const { balance, hasUsdcTrustline, refresh, publicKey } = useWallet()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (hasUsdcTrustline === true || success) return null

  const needsFunding =
    CURRENT_NETWORK.isTest &&
    balance != null &&
    parseFloat(balance) < 1

  const handleEnable = async () => {
    setLoading(true)
    setError(null)
    try {
      if (needsFunding && publicKey) {
        await fundWithFriendbot(publicKey)
        await new Promise((r) => setTimeout(r, 2000))
      }

      const stored = await getSecure('rowan_stellar_keypair')
      if (!stored) throw new Error('Wallet not found. Please re-import your wallet.')
      const kp = JSON.parse(stored)
      if (!kp.secretKey) throw new Error('Wallet key data is corrupted. Please re-import your wallet.')

      const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL
      await addUsdcTrustline(kp.secretKey, horizonUrl)
      setSuccess(true)
      await refresh()
      onEnabled?.()
    } catch (err) {
      setError(err.message || 'Could not enable USDC')
    } finally {
      setLoading(false)
    }
  }

  if (compact) {
    return (
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mt-4">
        <p className="text-rowan-text text-sm font-medium">Enable USDC in your wallet</p>
        <p className="text-rowan-muted text-xs mt-1">
          Required before you can buy USDC. This is a one-time setup on Stellar.
        </p>
        {error && <p className="text-rowan-red text-xs mt-2">{error}</p>}
        <Button className="w-full mt-3" size="sm" loading={loading} onClick={handleEnable}>
          {needsFunding ? 'Fund wallet & enable USDC' : 'Enable USDC'}
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <Coins size={20} className="text-rowan-yellow shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-rowan-text text-sm font-semibold">Enable USDC receiving</p>
          <p className="text-rowan-muted text-xs mt-1">
            Your wallet needs a USDC trustline on Stellar before traders can send you USDC.
            This is free and only needs to be done once.
          </p>
          {needsFunding && (
            <div className="flex items-start gap-2 mt-2">
              <AlertTriangle size={14} className="text-rowan-yellow shrink-0 mt-0.5" />
              <p className="text-rowan-muted text-xs">
                Your wallet needs a small XLM balance first — we&apos;ll fund it from Friendbot on testnet.
              </p>
            </div>
          )}
          {error && <p className="text-rowan-red text-xs mt-2">{error}</p>}
          <Button className="w-full mt-3" size="sm" loading={loading} onClick={handleEnable}>
            {needsFunding ? 'Fund wallet & enable USDC' : 'Enable USDC in wallet'}
          </Button>
        </div>
      </div>
    </div>
  )
}
