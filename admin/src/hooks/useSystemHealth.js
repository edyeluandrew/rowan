import { useState, useEffect, useCallback, useRef } from 'react'
import { getSystemHealth, getSystemAlerts } from '../api/system'
import { HEALTH_REFRESH_INTERVAL } from '../utils/constants'

export default function useSystemHealth() {
  const [health, setHealth] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetch = useCallback(async () => {
    try {
      setError(null)
      const [healthRes, alertsRes] = await Promise.all([
        getSystemHealth(),
        getSystemAlerts(),
      ])
      setHealth(healthRes)
      setAlerts(alertsRes.alerts || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    intervalRef.current = setInterval(fetch, HEALTH_REFRESH_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetch])

  return { health, alerts, loading, error, refresh: fetch }
}
