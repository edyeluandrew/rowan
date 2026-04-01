import { useState, useEffect, useCallback } from 'react'
import { getSystemHealth } from '../../../shared/services/api/system'
import { handleDataError } from '../../../shared/hooks/useDataFetch'

export default function useSystemHealth() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getSystemHealth()
      setData(result)
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { data, loading, error, refresh }
}
