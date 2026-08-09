import { useState, useEffect, useCallback, useRef } from 'react'
import { getCurrentRates, getAllRates } from '../api/rates'
import { QUOTE_REFRESH_INTERVAL } from '../utils/constants'

/**
 * Hook to fetch and auto-refresh live exchange rates.
 * refresh() resolves with { rates, allRates, fetchedAt, error } for quote-lock gates.
 */
export default function useRates(preferredFiat = 'UGX') {
  const [rates, setRates] = useState(null)
  const [allRates, setAllRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const intervalRef = useRef(null)

  const fetchRates = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [current, all] = await Promise.all([
        getCurrentRates(preferredFiat),
        getAllRates(),
      ])
      const nextAll = all?.rates ?? all
      const at = Date.now()
      setRates(current)
      setAllRates(nextAll)
      setFetchedAt(at)
      setError(null)
      return { rates: current, allRates: nextAll, fetchedAt: at, error: null }
    } catch (err) {
      setError(err)
      return { rates: null, allRates: null, fetchedAt: null, error: err }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [preferredFiat])

  useEffect(() => {
    fetchRates()
    intervalRef.current = setInterval(() => fetchRates(true), QUOTE_REFRESH_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetchRates])

  return {
    rates,
    allRates,
    loading,
    refreshing,
    error,
    fetchedAt,
    refresh: () => fetchRates(true),
  }
}
