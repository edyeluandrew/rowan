import { useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentRates, getAllRates } from '../api/rates'
import { QUOTE_REFRESH_INTERVAL } from '../utils/constants'

/**
 * Hook to fetch and auto-refresh live exchange rates.
 */
export default function useRates() {
  const [rates, setRates] = useState(null)
  const [allRates, setAllRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchRates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [current, all] = await Promise.all([
        getCurrentRates(),
        getAllRates(),
      ])
      setRates(current)
      setAllRates(all)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchRates()
    intervalRef.current = setInterval(() => fetchRates(true), QUOTE_REFRESH_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetchRates])

  return { rates, allRates, loading, refreshing, error, refresh: () => fetchRates(true) }
}
