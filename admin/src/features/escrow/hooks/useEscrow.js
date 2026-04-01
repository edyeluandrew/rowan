import { useState, useEffect, useCallback } from 'react'
import { getEscrowStatus, getEscrowTransactions } from '../../../shared/services/api/escrow'
import { handleDataError } from '../../../shared/hooks/useDataFetch'

export default function useEscrow() {
  const [status, setStatus] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [statusRes, txRes] = await Promise.all([
        getEscrowStatus(),
        getEscrowTransactions(),
      ])
      setStatus(statusRes)
      setTransactions(txRes?.transactions || [])
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [])

  return { status, transactions, loading, error, refresh }
}