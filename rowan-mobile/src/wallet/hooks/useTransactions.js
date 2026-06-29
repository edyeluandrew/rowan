import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getHistory } from '../api/user'
import { useSocketContext } from '../context/SocketContext'
import { normalizeWalletHistoryResponse } from '../utils/transactions'

const HISTORY_REFRESH_EVENTS = [
  'transaction_complete',
  'transaction_update',
  'transaction_refunded',
  'trader_matched',
  'trader_rematch',
  'dispute_opened',
  'dispute_resolved',
]

/**
 * Hook to fetch paginated transaction history.
 */
export default function useTransactions() {
  const { pathname } = useLocation()
  const { on, off } = useSocketContext()
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPage = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getHistory({ page: pageNum, limit: 20 })
      const { transactions: list, stats: nextStats } = normalizeWalletHistoryResponse(data)

      if (append) {
        setTransactions((prev) => [...prev, ...list])
      } else {
        setTransactions(list)
      }

      setStats((prev) => {
        const merged = nextStats || prev
        if (merged && pageNum === 1 && list.length > 0 && merged.total < list.length) {
          return { ...merged, total: list.length }
        }
        return merged
      })
      setHasMore(list.length === 20)
      setPage(pageNum)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchPage(1), [fetchPage])

  useEffect(() => {
    fetchPage(1)
  }, [fetchPage])

  useEffect(() => {
    if (pathname === '/wallet/home' || pathname === '/wallet/history') {
      refresh()
    }
  }, [pathname, refresh])

  useEffect(() => {
    const handleRefresh = () => refresh()

    HISTORY_REFRESH_EVENTS.forEach((event) => on(event, handleRefresh))
    return () => {
      HISTORY_REFRESH_EVENTS.forEach((event) => off(event, handleRefresh))
    }
  }, [on, off, refresh])

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchPage(page + 1, true)
    }
  }, [fetchPage, page, hasMore, loading])

  return { transactions, stats, loading, error, hasMore, loadMore, refresh }
}
