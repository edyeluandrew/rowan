import { useState, useEffect, useCallback } from 'react'
import { getSecure, setSecure } from '../../shared/utils/storage'
import {
  generateKeypair,
  loadAccountBalances,
  addUsdcTrustline,
  swapXlmToUsdc,
  isValidSecretKey,
  keypairFromSecret,
} from '../../wallet/utils/stellar'
import { fundWithFriendbot } from '../../wallet/utils/friendbot'
import { CURRENT_NETWORK } from '../../wallet/utils/constants'
import { verifyWalletAddress } from '../api/wallet'

export const TRADER_KEY_STORAGE = 'rowan_trader_stellar_keypair'

/**
 * Trader's in-app Stellar wallet — create, fund, trustline, swap, send.
 * Keys stay on-device; public address is synced to the trader profile.
 */
export default function useTraderWallet() {
  const horizonUrl = import.meta.env.VITE_STELLAR_HORIZON_URL
  const [keypair, setKeypair] = useState(null)
  const [linkedAddress, setLinkedAddress] = useState(null)
  const [xlmBalance, setXlmBalance] = useState(null)
  const [usdcBalance, setUsdcBalance] = useState(null)
  const [hasUsdcTrustline, setHasUsdcTrustline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const loadStoredKeypair = useCallback(async () => {
    const stored = await getSecure(TRADER_KEY_STORAGE)
    if (!stored) return null
    try {
      return JSON.parse(stored)
    } catch {
      return null
    }
  }, [])

  const refresh = useCallback(async () => {
    const kp = await loadStoredKeypair()
    setKeypair(kp)
    if (!kp?.publicKey) {
      setXlmBalance(null)
      setUsdcBalance(null)
      setHasUsdcTrustline(null)
      return
    }
    try {
      const balances = await loadAccountBalances(kp.publicKey, horizonUrl)
      setXlmBalance(balances.xlm)
      setUsdcBalance(balances.usdc)
      setHasUsdcTrustline(balances.hasUsdcTrustline)
    } catch (err) {
      setError(err.message)
    }
  }, [horizonUrl, loadStoredKeypair])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [refresh])

  const syncLinkedAddress = useCallback(async (publicKey) => {
    await verifyWalletAddress(publicKey)
    setLinkedAddress(publicKey)
  }, [])

  const createWallet = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const kp = generateKeypair()
      await setSecure(TRADER_KEY_STORAGE, JSON.stringify(kp))
      await syncLinkedAddress(kp.publicKey)
      if (CURRENT_NETWORK.friendbotUrl) {
        await fundWithFriendbot(kp.publicKey)
        await new Promise((r) => setTimeout(r, 2000))
      }
      setKeypair(kp)
      await refresh()
      return kp
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Could not create wallet'
      setError(msg)
      throw new Error(msg)
    } finally {
      setBusy(false)
    }
  }, [refresh, syncLinkedAddress])

  const importWallet = useCallback(async (secretKey) => {
    const secret = secretKey.trim()
    if (!isValidSecretKey(secret)) {
      throw new Error('Enter a valid Stellar secret key (starts with S)')
    }
    setBusy(true)
    setError(null)
    try {
      const kpObj = keypairFromSecret(secret)
      const kp = { publicKey: kpObj.publicKey(), secretKey: secret }
      await setSecure(TRADER_KEY_STORAGE, JSON.stringify(kp))
      await syncLinkedAddress(kp.publicKey)
      setKeypair(kp)
      await refresh()
      return kp
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Could not import wallet'
      setError(msg)
      throw new Error(msg)
    } finally {
      setBusy(false)
    }
  }, [refresh, syncLinkedAddress])

  const fundTestnet = useCallback(async () => {
    if (!keypair?.publicKey) throw new Error('Create a Rowan wallet first')
    if (!CURRENT_NETWORK.friendbotUrl) throw new Error('Testnet funding is not available on mainnet')
    setBusy(true)
    setError(null)
    try {
      await fundWithFriendbot(keypair.publicKey)
      await new Promise((r) => setTimeout(r, 2000))
      await refresh()
    } catch (err) {
      const msg = err.message || 'Friendbot funding failed'
      setError(msg)
      throw new Error(msg)
    } finally {
      setBusy(false)
    }
  }, [keypair?.publicKey, refresh])

  const enableUsdc = useCallback(async () => {
    if (!keypair?.secretKey) throw new Error('Create a Rowan wallet first')
    setBusy(true)
    setError(null)
    try {
      if (CURRENT_NETWORK.isTest && (xlmBalance == null || xlmBalance < 1)) {
        await fundWithFriendbot(keypair.publicKey)
        await new Promise((r) => setTimeout(r, 2000))
      }
      await addUsdcTrustline(keypair.secretKey, horizonUrl)
      await refresh()
    } catch (err) {
      const msg = err.message || 'Could not enable USDC'
      setError(msg)
      throw new Error(msg)
    } finally {
      setBusy(false)
    }
  }, [horizonUrl, keypair, refresh, xlmBalance])

  const swapToUsdc = useCallback(async (usdcAmount) => {
    if (!keypair?.secretKey) throw new Error('Create a Rowan wallet first')
    if (!hasUsdcTrustline) throw new Error('Enable USDC in your Rowan wallet first')
    setBusy(true)
    setError(null)
    try {
      const result = await swapXlmToUsdc({
        sourceSecretKey: keypair.secretKey,
        usdcAmount,
        horizonUrl,
      })
      await refresh()
      return result
    } catch (err) {
      const msg = err.message || 'Swap failed'
      setError(msg)
      throw new Error(msg)
    } finally {
      setBusy(false)
    }
  }, [hasUsdcTrustline, horizonUrl, keypair?.secretKey, refresh])

  const isLinked = !!keypair?.publicKey && (
    !linkedAddress || linkedAddress === keypair.publicKey
  )

  return {
    keypair,
    publicKey: keypair?.publicKey || null,
    linkedAddress,
    xlmBalance,
    usdcBalance,
    hasUsdcTrustline,
    loading,
    busy,
    error,
    isReady: !!keypair?.secretKey && hasUsdcTrustline === true,
    isLinked,
    refresh,
    createWallet,
    importWallet,
    fundTestnet,
    enableUsdc,
    swapToUsdc,
    setLinkedAddress,
  }
}
