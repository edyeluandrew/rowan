import { useState, useCallback } from 'react'
import { getOverview } from '../../../shared/services/api/overview'
import { OVERVIEW_REFRESH_INTERVAL } from '../../../shared/utils/constants'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useAutoRefresh, useSocketRefresh } from '../../../shared/hooks/useDataUtils'

export default function useOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const result = await getOverview()
      setData(result)
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-refresh at regular interval
  useAutoRefresh(refresh, OVERVIEW_REFRESH_INTERVAL, [])

  // Socket-based real-time updates
  useSocketRefresh(refresh, [
    'transaction_update',
    'new_dispute',
    'trader_float_low',
    'system_alert',
    'escrow_low_balance',
  ])

  return { data, loading, error, refresh }
}
