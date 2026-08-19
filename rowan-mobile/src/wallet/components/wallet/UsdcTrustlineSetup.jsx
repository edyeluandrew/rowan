import { useEffect } from 'react'
import { getSecure } from '../../utils/storage'
import { provisionUsdcWallet, fundTestUsdcWallet } from '../../utils/stellar'
import { CURRENT_NETWORK } from '../../utils/constants'
import useWallet from '../../hooks/useWallet'

/**
 * Silent auto-setup: 2 XLM + USDC trustline. No user button.
 */
export default function UsdcTrustlineSetup({ onEnabled }) {
  const { hasUsdcTrustline, refresh, publicKey } = useWallet()

  useEffect(() => {
    if (hasUsdcTrustline === true || !publicKey) return undefined
    let cancelled = false

    ;(async () => {
      try {
        const stored = await getSecure('rowan_stellar_keypair')
        if (!stored || cancelled) return
        const kp = JSON.parse(stored)
        if (!kp.secretKey) return

        const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL
        if (CURRENT_NETWORK.isTest) {
          await fundTestUsdcWallet({
            secretKey: kp.secretKey,
            publicKey: kp.publicKey || publicKey,
            horizonUrl,
          })
        } else {
          await provisionUsdcWallet({
            secretKey: kp.secretKey,
            publicKey: kp.publicKey || publicKey,
            horizonUrl,
          })
        }
        if (!cancelled) {
          await refresh()
          onEnabled?.()
        }
      } catch {
        // useWallet retries on next balance load
      }
    })()

    return () => { cancelled = true }
  }, [hasUsdcTrustline, onEnabled, publicKey, refresh])

  return null
}
