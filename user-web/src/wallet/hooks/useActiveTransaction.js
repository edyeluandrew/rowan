import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getActiveTransaction } from '../api/user'
import { normalizeWalletTransaction } from '../utils/transactions'
import { useSocketContext } from '../context/SocketContext'

const REFRESH_EVENTS = [
  'transaction_update',
  'transaction_complete',
  'transaction_refunded',
  'trader_matched',
  'trader_rematch',
  'dispute_opened',
  'dispute_resolved',
]

const HOME_PATHS = new Set([
  '/wallet/home',
  '/wallet/history',
  '/wallet/p2p',
  '/wallet/profile',
])

/**
 * Fetch the user's single active in-progress order (if any).
 * Source of truth for Home resume banner + blocking new trades.
 */
export default function useActiveTransaction() {
  const { pathname } = useLocation()
  const { on, off } = useSocketContext()
  const [activeTransaction, setActiveTransaction] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await getActiveTransaction()
      setActiveTransaction(
        data?.active && data.transaction
          ? normalizeWalletTransaction(data.transaction)
          : null
      )
    } catch {
      setActiveTransaction(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Resume after kill-app / back to Home: re-check open order
  useEffect(() => {
    if (HOME_PATHS.has(pathname) || pathname.startsWith('/wallet/transaction')) {
      refresh()
    }
  }, [pathname, refresh])

  useEffect(() => {
    const onFocus = () => {
      if (HOME_PATHS.has(pathname) || pathname.startsWith('/wallet/transaction')) {
        refresh()
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [pathname, refresh])

  useEffect(() => {
    const handler = () => refresh()
    REFRESH_EVENTS.forEach((evt) => on(evt, handler))
    return () => REFRESH_EVENTS.forEach((evt) => off(evt, handler))
  }, [on, off, refresh])

  return { activeTransaction, loading, refresh, hasActiveOrder: !!activeTransaction }
}
