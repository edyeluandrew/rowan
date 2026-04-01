import { useState, useCallback } from 'react'
import { getRevenue, getVolume, getTraderPerformance, getUserAnalytics } from '../../../shared/services/api/analytics'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useAnalyticsStream } from '../../../shared/hooks/useAdminRealTime'

function useRevenue(period) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { metrics, isConnected } = useAnalyticsStream()

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getRevenue({ period })
      setData(result)
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [period])

  return { data: data || { revenue_today: metrics.revenue_today }, loading, error, refresh, isRealTime: isConnected }
}

function useVolume(period, groupBy) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { metrics, isConnected } = useAnalyticsStream()

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getVolume({ period, group_by: groupBy })
      setData(result)
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [period, groupBy])

  return { data: data || { volume_today: metrics.volume_today }, loading, error, refresh, isRealTime: isConnected }
}

function useTraderPerformance() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getTraderPerformance()
      setData(result)
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, refresh }
}

function useUserAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getUserAnalytics()
      setData(result)
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  return { data, loading, error, refresh }
}

export { useRevenue, useVolume, useTraderPerformance, useUserAnalytics }
