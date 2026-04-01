import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from '../context/SocketContext'

/**
 * Real-time data stream hooks for all admin features
 * Each hook maintains local state synced with WebSocket updates
 */

// ============================================
// TRADERS STREAM
// ============================================
export const useTraderStream = () => {
  const { on, off, isConnected } = useSocket()
  const [traders, setTraders] = useState([])
  const tradersRef = useRef(new Map())

  useEffect(() => {
    if (!isConnected) return

    const handleTraderUpdate = (data) => {
      setTraders((prev) => {
        const updated = [...prev]
        const idx = updated.findIndex((t) => t.id === data.id)
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...data }
        } else {
          updated.unshift(data)
        }
        return updated.slice(0, 200)
      })
      tradersRef.current.set(data.id, data)
    }

    const handleTraderNew = (data) => {
      setTraders((prev) => [data, ...prev.slice(0, 199)])
      tradersRef.current.set(data.id, data)
    }

    const handleTraderDelete = (data) => {
      setTraders((prev) => prev.filter((t) => t.id !== data.id))
      tradersRef.current.delete(data.id)
    }

    on('trader_update', handleTraderUpdate)
    on('trader_new', handleTraderNew)
    on('trader_delete', handleTraderDelete)
    on('trader_verified', handleTraderUpdate)
    on('trader_suspended', handleTraderUpdate)

    return () => {
      off('trader_update', handleTraderUpdate)
      off('trader_new', handleTraderNew)
      off('trader_delete', handleTraderDelete)
      off('trader_verified', handleTraderUpdate)
      off('trader_suspended', handleTraderUpdate)
    }
  }, [isConnected, on, off])

  const getTrader = useCallback((id) => tradersRef.current.get(id), [])
  const getByStatus = useCallback(
    (status) => traders.filter((t) => t.verification_status === status || t.status === status),
    [traders]
  )

  return { traders, isConnected, getTrader, getByStatus }
}

// ============================================
// DISPUTES STREAM
// ============================================
export const useDisputeStream = () => {
  const { on, off, isConnected } = useSocket()
  const [disputes, setDisputes] = useState([])
  const disputesRef = useRef(new Map())

  useEffect(() => {
    if (!isConnected) return

    const handleDisputeUpdate = (data) => {
      setDisputes((prev) => {
        const updated = [...prev]
        const idx = updated.findIndex((d) => d.id === data.id)
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], ...data }
        }
        return updated
      })
      disputesRef.current.set(data.id, data)
    }

    const handleDisputeNew = (data) => {
      setDisputes((prev) => [data, ...prev.slice(0, 199)])
      disputesRef.current.set(data.id, data)
    }

    on('dispute_update', handleDisputeUpdate)
    on('dispute_new', handleDisputeNew)
    on('dispute_resolved', handleDisputeUpdate)

    return () => {
      off('dispute_update', handleDisputeUpdate)
      off('dispute_new', handleDisputeNew)
      off('dispute_resolved', handleDisputeUpdate)
    }
  }, [isConnected, on, off])

  const getDispute = useCallback((id) => disputesRef.current.get(id), [])
  const getByStatus = useCallback(
    (status) => disputes.filter((d) => d.status === status),
    [disputes]
  )
  const getOpen = useCallback(() => disputes.filter((d) => d.status === 'OPEN'), [disputes])

  return { disputes, isConnected, getDispute, getByStatus, getOpen }
}

// ============================================
// ESCROW STREAM
// ============================================
export const useEscrowStream = () => {
  const { on, off, isConnected } = useSocket()
  const [escrow, setEscrow] = useState({
    total_locked: 0,
    available: 0,
    pending_release: 0,
    health_status: 'healthy',
  })

  useEffect(() => {
    if (!isConnected) return

    const handleEscrowUpdate = (data) => {
      setEscrow((prev) => ({ ...prev, ...data }))
    }

    on('escrow_update', handleEscrowUpdate)
    on('escrow_deposit', handleEscrowUpdate)
    on('escrow_release', handleEscrowUpdate)
    on('escrow_low_balance', handleEscrowUpdate)

    return () => {
      off('escrow_update', handleEscrowUpdate)
      off('escrow_deposit', handleEscrowUpdate)
      off('escrow_release', handleEscrowUpdate)
      off('escrow_low_balance', handleEscrowUpdate)
    }
  }, [isConnected, on, off])

  return { escrow, isConnected }
}

// ============================================
// ANALYTICS STREAM
// ============================================
export const useAnalyticsStream = () => {
  const { on, off, isConnected } = useSocket()
  const [metrics, setMetrics] = useState({
    revenue_today: 0,
    volume_today: 0,
    transactions_today: 0,
    avg_completion_time: 0,
    success_rate: 0,
    active_traders: 0,
    new_users_today: 0,
    top_networks: [],
  })

  useEffect(() => {
    if (!isConnected) return

    const handleMetricsUpdate = (data) => {
      setMetrics((prev) => ({ ...prev, ...data }))
    }

    on('analytics_update', handleMetricsUpdate)
    on('metrics_daily_reset', handleMetricsUpdate)
    on('revenue_update', handleMetricsUpdate)
    on('volume_update', handleMetricsUpdate)

    return () => {
      off('analytics_update', handleMetricsUpdate)
      off('metrics_daily_reset', handleMetricsUpdate)
      off('revenue_update', handleMetricsUpdate)
      off('volume_update', handleMetricsUpdate)
    }
  }, [isConnected, on, off])

  return { metrics, isConnected }
}

// ============================================
// SYSTEM HEALTH STREAM
// ============================================
export const useSystemHealthStream = () => {
  const { on, off, isConnected } = useSocket()
  const [health, setHealth] = useState({
    database_status: 'unknown',
    redis_status: 'unknown',
    horizon_status: 'unknown',
    api_status: 'unknown',
    alerts: [],
    uptime: 0,
    response_time_ms: 0,
  })

  useEffect(() => {
    if (!isConnected) return

    const handleHealthUpdate = (data) => {
      setHealth((prev) => ({ ...prev, ...data }))
    }

    const handleAlert = (data) => {
      setHealth((prev) => ({
        ...prev,
        alerts: [data, ...prev.alerts.slice(0, 19)],
      }))
    }

    on('system_health_update', handleHealthUpdate)
    on('system_alert', handleAlert)
    on('service_status_change', handleHealthUpdate)

    return () => {
      off('system_health_update', handleHealthUpdate)
      off('system_alert', handleAlert)
      off('service_status_change', handleHealthUpdate)
    }
  }, [isConnected, on, off])

  return { health, isConnected }
}

// ============================================
// RATES STREAM
// ============================================
export const useRatesStream = () => {
  const { on, off, isConnected } = useSocket()
  const [rates, setRates] = useState({
    xlm_usd: 0,
    usdc_usd: 1,
    platform_spread: 1.25,
    platform_fee: 1,
    network_fees: {},
    last_updated: null,
  })

  useEffect(() => {
    if (!isConnected) return

    const handleRateUpdate = (data) => {
      setRates((prev) => ({ ...prev, ...data, last_updated: new Date().toISOString() }))
    }

    on('rates_update', handleRateUpdate)
    on('platform_fee_update', handleRateUpdate)
    on('network_fee_update', handleRateUpdate)

    return () => {
      off('rates_update', handleRateUpdate)
      off('platform_fee_update', handleRateUpdate)
      off('network_fee_update', handleRateUpdate)
    }
  }, [isConnected, on, off])

  return { rates, isConnected }
}

// ============================================
// OVERVIEW STREAM (Combined stats)
// ============================================
export const useOverviewStream = () => {
  const { on, off, isConnected } = useSocket()
  const [stats, setStats] = useState({
    transactions_today: 0,
    active_traders: 0,
    open_disputes: 0,
    revenue_today: 0,
    volume_today: 0,
    avg_settlement_time: 0,
    pending_approvals: 0,
    escrow_locked: 0,
    failed_today: 0,
    success_rate: 0,
    alerts: [],
  })

  useEffect(() => {
    if (!isConnected) return

    const handleStatsUpdate = (data) => {
      setStats((prev) => ({ ...prev, ...data }))
    }

    on('stats_update', handleStatsUpdate)
    on('overview_refresh', handleStatsUpdate)

    return () => {
      off('stats_update', handleStatsUpdate)
      off('overview_refresh', handleStatsUpdate)
    }
  }, [isConnected, on, off])

  return { stats, isConnected }
}

// ============================================
// ADMIN ACTION STREAM (Audit log)
// ============================================
export const useAdminActionStream = () => {
  const { on, off, isConnected } = useSocket()
  const [actions, setActions] = useState([])

  useEffect(() => {
    if (!isConnected) return

    const handleAction = (data) => {
      setActions((prev) => [
        { ...data, timestamp: new Date().toISOString() },
        ...prev.slice(0, 99),
      ])
    }

    on('admin_action', handleAction)

    return () => {
      off('admin_action', handleAction)
    }
  }, [isConnected, on, off])

  return { actions, isConnected }
}
