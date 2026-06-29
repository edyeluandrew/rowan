import { useState, useEffect, useCallback } from 'react'
import { getActiveTransaction } from '../api/user'
import { normalizeWalletTransaction } from '../utils/transactions'
import { useSocketContext } from '../context/SocketContext'

const REFRESH_EVENTS = [
  'transaction_update',
  'transaction_complete',
  'transaction_refunded',
  'trader_matched',
  'dispute_opened',
]

/**
 * Fetch the user's single active in-progress order (if any).
 */
export default function useActiveTransaction() {
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

  useEffect(() => {
    const handler = () => refresh()
    REFRESH_EVENTS.forEach((evt) => on(evt, handler))
    return () => REFRESH_EVENTS.forEach((evt) => off(evt, handler))
  }, [on, off, refresh])

  return { activeTransaction, loading, refresh, hasActiveOrder: !!activeTransaction }
}
