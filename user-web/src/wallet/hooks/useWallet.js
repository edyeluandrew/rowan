import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadAccountBalances, provisionUsdcWallet, fundTestUsdcWallet } from '../utils/stellar'
import { getSecure } from '../utils/storage'
import { CURRENT_NETWORK, TESTNET_MIN_USDC_FOR_SKIP } from '../utils/constants'
import { getHorizonUrl } from '../../shared/utils/config'

/**
 * Hook to load and refresh the user's Stellar wallet balances from Horizon.
 * Auto-provisions USDC trustline and testnet starter USDC for legacy wallets.
 */
export default function useWallet() {
  const { keypair } = useAuth()
  const [balance, setBalance] = useState(null)
  const [usdcBalance, setUsdcBalance] = useState(null)
  const [hasUsdcTrustline, setHasUsdcTrustline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [testUsdcProvisioning, setTestUsdcProvisioning] = useState('idle')
  const provisionAttempted = useRef(null)
  const testUsdcAttempted = useRef(null)

  const horizonUrl = getHorizonUrl()

  const fetchBalance = useCallback(async () => {
    if (!keypair?.publicKey) return
    setLoading(true)
    setError(null)
    try {
      const balances = await loadAccountBalances(keypair.publicKey, horizonUrl)
      setBalance(balances.xlm)
      setUsdcBalance(balances.usdc)
      setHasUsdcTrustline(balances.hasUsdcTrustline)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [horizonUrl, keypair?.publicKey])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  useEffect(() => {
    if (!keypair?.publicKey || loading || hasUsdcTrustline !== false) return
    if (provisionAttempted.current === keypair.publicKey) return

    let cancelled = false
    provisionAttempted.current = keypair.publicKey

    ;(async () => {
      try {
        const stored = await getSecure('rowan_stellar_keypair')
        if (!stored || cancelled) return
        const kp = JSON.parse(stored)
        if (!kp.secretKey || kp.publicKey !== keypair.publicKey) return

        await provisionUsdcWallet({
          secretKey: kp.secretKey,
          publicKey: kp.publicKey,
          horizonUrl,
        })
        if (!cancelled) await fetchBalance()
      } catch {
        provisionAttempted.current = null
      }
    })()

    return () => { cancelled = true }
  }, [fetchBalance, hasUsdcTrustline, horizonUrl, keypair?.publicKey, loading])

  useEffect(() => {
    if (!CURRENT_NETWORK.isTest || !keypair?.publicKey || loading) return
    if (hasUsdcTrustline === false) return
    if (usdcBalance != null && usdcBalance >= TESTNET_MIN_USDC_FOR_SKIP) return
    if (testUsdcAttempted.current === keypair.publicKey) return

    let cancelled = false
    testUsdcAttempted.current = keypair.publicKey
    setTestUsdcProvisioning('loading')

    ;(async () => {
      try {
        const stored = await getSecure('rowan_stellar_keypair')
        if (!stored || cancelled) return
        const kp = JSON.parse(stored)
        if (!kp.secretKey || kp.publicKey !== keypair.publicKey) return

        await fundTestUsdcWallet({
          secretKey: kp.secretKey,
          publicKey: kp.publicKey,
          horizonUrl,
        })
        if (!cancelled) {
          await fetchBalance()
          setTestUsdcProvisioning('done')
        }
      } catch {
        if (!cancelled) setTestUsdcProvisioning('error')
        testUsdcAttempted.current = null
      }
    })()

    return () => { cancelled = true }
  }, [fetchBalance, hasUsdcTrustline, horizonUrl, keypair?.publicKey, loading, usdcBalance])

  return {
    balance,
    usdcBalance,
    hasUsdcTrustline,
    loading,
    error,
    refresh: fetchBalance,
    testUsdcProvisioning,
    publicKey: keypair?.publicKey,
  }
}
