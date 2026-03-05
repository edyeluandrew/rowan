import { useState, useEffect, useCallback, useRef } from 'react'
import { getEscrowStatus, getEscrowTransactions } from '../api/escrow'
import { ESCROW_REFRESH_INTERVAL } from '../utils/constants'

export default function useEscrow() {
  const [status, setStatus] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetch = useCallback(async () => {
    try {
      setError(null)
      const [statusRes, txRes] = await Promise.all([
        getEscrowStatus(),
        getEscrowTransactions(),
      ])
      setStatus(statusRes)
      setTransactions(txRes.transactions || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    intervalRef.current = setInterval(fetch, ESCROW_REFRESH_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetch])

  return { status, transactions, loading, error, refresh: fetch }
}
