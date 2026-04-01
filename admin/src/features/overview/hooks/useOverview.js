import { useState, useCallback } from 'react'
import { getOverview } from '../../../shared/services/api/overview'
import { OVERVIEW_REFRESH_INTERVAL } from '../../../shared/utils/constants'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useAutoRefresh, useSocketRefresh } from '../../../shared/hooks/useDataUtils'
import { useTransactionStream } from '../../../shared/hooks/useTransactionStream'

export default function useOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { transactions: recentStream } = useTransactionStream()

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await getOverview()
      // Merge server data with real-time stream for recent transactions
      setData({
        ...result,
        recent_transactions: recentStream.slice(0, 10),
      })
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [recentStream])

  // Auto-refresh at regular interval
  useAutoRefresh(refresh, OVERVIEW_REFRESH_INTERVAL, [recentStream])

  // Socket-based real-time updates
  useSocketRefresh(refresh, [
    'transaction_update',
    'transaction_state_changed',
    'new_dispute',
    'trader_float_low',
    'system_alert',
    'escrow_low_balance',
  ])

  return { data, loading, error, refresh }
}
