import { useState, useEffect, useCallback, useRef } from 'react'
import { getSecure, setSecure } from '../../shared/utils/storage'
import {
  generateKeypair,
  loadAccountBalances,
  provisionUsdcWallet,
  fundTestUsdcWallet,
  swapXlmToUsdc,
  isValidSecretKey,
  keypairFromSecret,
} from '../../wallet/utils/stellar'
import { CURRENT_NETWORK } from '../../wallet/utils/constants'
import { verifyWalletAddress } from '../api/wallet'

export const TRADER_KEY_STORAGE = 'rowan_trader_stellar_keypair'

export const WALLET_ACTIONS = {
  CREATE: 'create',
  IMPORT: 'import',
  FUND: 'fund',
  ENABLE_USDC: 'enableUsdc',
  SWAP: 'swap',
}

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
  const [activeAction, setActiveAction] = useState(null)
  const [error, setError] = useState(null)
  const provisionAttempted = useRef(null)

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

  useEffect(() => {
    if (!keypair?.publicKey || loading || hasUsdcTrustline !== false) return
    if (provisionAttempted.current === keypair.publicKey) return

    let cancelled = false
    provisionAttempted.current = keypair.publicKey

    ;(async () => {
      try {
        if (!keypair.secretKey) return
        await provisionUsdcWallet({
          secretKey: keypair.secretKey,
          publicKey: keypair.publicKey,
          horizonUrl,
        })
        if (!cancelled) await refresh()
      } catch {
        provisionAttempted.current = null
      }
    })()

    return () => { cancelled = true }
  }, [hasUsdcTrustline, horizonUrl, keypair, loading, refresh])

  const syncLinkedAddress = useCallback(async (publicKey) => {
    await verifyWalletAddress(publicKey)
    setLinkedAddress(publicKey)
  }, [])

  const runWalletAction = useCallback(async (action, fn) => {
    if (activeAction) {
      throw new Error('Please wait for the current action to finish')
    }
    setActiveAction(action)
    setError(null)
    try {
      return await fn()
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Action failed'
      setError(msg)
      throw new Error(msg)
    } finally {
      setActiveAction(null)
    }
  }, [activeAction])

  const createWallet = useCallback(async () => runWalletAction(WALLET_ACTIONS.CREATE, async () => {
    const kp = generateKeypair()
    await setSecure(TRADER_KEY_STORAGE, JSON.stringify(kp))
    await syncLinkedAddress(kp.publicKey)
    if (CURRENT_NETWORK.isTest) {
      await fundTestUsdcWallet({
        secretKey: kp.secretKey,
        publicKey: kp.publicKey,
        horizonUrl,
      })
    } else {
      await provisionUsdcWallet({
        secretKey: kp.secretKey,
        publicKey: kp.publicKey,
        horizonUrl,
      })
    }
    setKeypair(kp)
    await refresh()
    return kp
  }), [horizonUrl, refresh, runWalletAction, syncLinkedAddress])

  const importWallet = useCallback(async (secretKey) => {
    const secret = secretKey.trim()
    if (!isValidSecretKey(secret)) {
      throw new Error('Enter a valid Stellar secret key (starts with S)')
    }
    return runWalletAction(WALLET_ACTIONS.IMPORT, async () => {
      const kpObj = keypairFromSecret(secret)
      const kp = { publicKey: kpObj.publicKey(), secretKey: secret }
      await setSecure(TRADER_KEY_STORAGE, JSON.stringify(kp))
      await syncLinkedAddress(kp.publicKey)
      if (CURRENT_NETWORK.isTest) {
        await fundTestUsdcWallet({
          secretKey: kp.secretKey,
          publicKey: kp.publicKey,
          horizonUrl,
        })
      } else {
        await provisionUsdcWallet({
          secretKey: kp.secretKey,
          publicKey: kp.publicKey,
          horizonUrl,
        })
      }
      setKeypair(kp)
      await refresh()
      return kp
    })
  }, [horizonUrl, refresh, runWalletAction, syncLinkedAddress])

  const fundTestnet = useCallback(async () => {
    if (!keypair?.publicKey) throw new Error('Create a Rowan wallet first')
    if (!CURRENT_NETWORK.friendbotUrl) throw new Error('Testnet funding is not available on mainnet')
    return runWalletAction(WALLET_ACTIONS.FUND, async () => {
      if (CURRENT_NETWORK.isTest) {
        await fundTestUsdcWallet({
          secretKey: keypair.secretKey,
          publicKey: keypair.publicKey,
          horizonUrl,
        })
      } else {
        await provisionUsdcWallet({
          secretKey: keypair.secretKey,
          publicKey: keypair.publicKey,
          horizonUrl,
        })
      }
      await refresh()
    })
  }, [horizonUrl, keypair, refresh, runWalletAction])

  const enableUsdc = useCallback(async () => {
    if (!keypair?.secretKey) throw new Error('Create a Rowan wallet first')
    return runWalletAction(WALLET_ACTIONS.ENABLE_USDC, async () => {
      if (CURRENT_NETWORK.isTest) {
        await fundTestUsdcWallet({
          secretKey: keypair.secretKey,
          publicKey: keypair.publicKey,
          horizonUrl,
        })
      } else {
        await provisionUsdcWallet({
          secretKey: keypair.secretKey,
          publicKey: keypair.publicKey,
          horizonUrl,
        })
      }
      await refresh()
    })
  }, [horizonUrl, keypair, refresh, runWalletAction])

  const swapToUsdc = useCallback(async (usdcAmount) => {
    if (!keypair?.secretKey) throw new Error('Create a Rowan wallet first')
    if (!hasUsdcTrustline) throw new Error('Enable USDC in your Rowan wallet first')
    return runWalletAction(WALLET_ACTIONS.SWAP, async () => {
      const result = await swapXlmToUsdc({
        sourceSecretKey: keypair.secretKey,
        usdcAmount,
        horizonUrl,
      })
      await refresh()
      return result
    })
  }, [hasUsdcTrustline, horizonUrl, keypair?.secretKey, refresh, runWalletAction])

  const isActionBusy = useCallback((action) => activeAction === action, [activeAction])

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
    activeAction,
    isActionBusy,
    busy: !!activeAction,
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
