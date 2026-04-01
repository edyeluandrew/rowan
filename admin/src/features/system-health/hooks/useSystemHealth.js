import { useState, useEffect, useCallback } from 'react'
import { getSystemHealth } from '../../../shared/services/api/system'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useSystemHealthStream } from '../../../shared/hooks/useAdminRealTime'

export default function useSystemHealth() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { health: data, isConnected } = useSystemHealthStream()

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      await getSystemHealth()
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh, isRealTime: isConnected }
}
