import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { loadAccountBalances } from '../utils/stellar'

/**
 * Hook to load and refresh the user's XLM balance from Horizon.
 */
export default function useWallet() {
  const { keypair } = useAuth()
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBalance = useCallback(async () => {
    if (!keypair?.publicKey) return
    setLoading(true)
    setError(null)
    try {
      const balances = await loadAccountBalances(
        keypair.publicKey,
        import.meta.env.VITE_STELLAR_HORIZON_URL
      )
      setBalance(balances.xlm)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [keypair?.publicKey])

  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  return { balance, loading, error, refresh: fetchBalance, publicKey: keypair?.publicKey }
}
