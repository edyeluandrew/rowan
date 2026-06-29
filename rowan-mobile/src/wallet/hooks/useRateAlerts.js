import { useState, useEffect, useCallback } from 'react'
import { getRateAlerts, createRateAlert, deleteRateAlert, updateRateAlert } from '../api/user'
import { MAX_ACTIVE_ALERTS } from '../utils/constants'

function normalizeAlert(row) {
  if (!row || typeof row !== 'object') return null
  return {
    ...row,
    targetRate: Number(row.targetRate ?? row.target_rate ?? 0),
    active: row.active !== false,
  }
}

function normalizeAlertList(payload) {
  const raw = payload?.alerts ?? payload?.data?.alerts ?? payload
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeAlert).filter(Boolean)
}

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
      setAlerts(normalizeAlertList(data))
    } catch (err) {
      setAlerts([])
      setError(err.response?.data?.error || err.message || 'Failed to load rate alerts')
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
      const alert = normalizeAlert(data?.alert || data)
      if (alert) setAlerts((prev) => [alert, ...prev])
      return alert
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
    const data = await updateRateAlert(alertId, { active: !alert.active })
    const updated = normalizeAlert(data?.alert || data)
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, ...updated, active: !alert.active } : a))
    )
  }, [alerts])

  return { alerts, loading, error, creating, fetch, create, remove, toggle }
}
