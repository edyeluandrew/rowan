import { useState, useEffect, useCallback } from 'react'
import { getEscrowStatus, getEscrowTransactions } from '../../../shared/services/api/escrow'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useEscrowStream } from '../../../shared/hooks/useAdminRealTime'

export default function useEscrow() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { escrow: status, isConnected } = useEscrowStream()

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const txRes = await getEscrowTransactions()
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

  return { status, transactions, loading, error, refresh, isRealTime: isConnected }
}