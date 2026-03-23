import { useState, useEffect, useCallback } from 'react'
import { getRateAlerts, createRateAlert, deleteRateAlert, updateRateAlert } from '../api/user'
import { MAX_ACTIVE_ALERTS } from '../utils/constants'

/**
 * Hook to manage rate alert CRUD and local state.
 */
export default function useRateAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRateAlerts()
      setAlerts(data.alerts || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load rate alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const create = useCallback(async ({ pair, direction, targetRate }) => {
    const active = alerts.filter((a) => a.active !== false)
    if (active.length >= MAX_ACTIVE_ALERTS) {
      throw new Error(`Maximum of ${MAX_ACTIVE_ALERTS} active alerts reached`)
    }
    setCreating(true)
    try {
      const data = await createRateAlert({ pair, direction, targetRate })
      setAlerts((prev) => [data.alert || data, ...prev])
      return data.alert || data
    } finally {
      setCreating(false)
    }
  }, [alerts])

  const remove = useCallback(async (alertId) => {
    await deleteRateAlert(alertId)
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }, [])

  const toggle = useCallback(async (alertId) => {
    const alert = alerts.find((a) => a.id === alertId)
    if (!alert) return
    const updated = await updateRateAlert(alertId, { active: !alert.active })
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, active: !a.active, ...updated } : a))
    )
  }, [alerts])

  return { alerts, loading, error, creating, fetch, create, remove, toggle }
}
