import { useState, useEffect, useCallback, useRef } from 'react'
import { getOverview } from '../api/overview'
import { useSocket } from '../context/SocketContext'
import { OVERVIEW_REFRESH_INTERVAL } from '../utils/constants'

export default function useOverview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { on, off } = useSocket()
  const intervalRef = useRef(null)

  const fetch = useCallback(async () => {
    try {
      setError(null)
      const result = await getOverview()
      setData(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    intervalRef.current = setInterval(fetch, OVERVIEW_REFRESH_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetch])

  // Real-time updates
  useEffect(() => {
    const handler = () => fetch()
    on('transaction_update', handler)
    on('new_dispute', handler)
    on('trader_float_low', handler)
    on('system_alert', handler)
    on('escrow_low_balance', handler)
    return () => {
      off('transaction_update', handler)
      off('new_dispute', handler)
      off('trader_float_low', handler)
      off('system_alert', handler)
      off('escrow_low_balance', handler)
    }
  }, [on, off, fetch])

  return { data, loading, error, refresh: fetch }
}
