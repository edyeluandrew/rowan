import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { getHistory, getTransactionHistory } from '../api/user'
import { useSocketContext } from '../context/SocketContext'
import { normalizeP2pHistoryResponse, normalizeWalletHistoryStats } from '../utils/transactions'

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
 * Unified P2P + utility history — same source as History tab.
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
    // Only show spinner on first load / load-more; keep Recent visible during refresh
    if (append) setLoading(true)
    setError(null)
    try {
      // History list is the source of truth (same as History tab). Stats is best-effort.
      const historyData = await getTransactionHistory({ page: pageNum, limit: 20, category: 'all' })
      const { transactions: list, pages } = normalizeP2pHistoryResponse(historyData)

      if (append) {
        setTransactions((prev) => {
          const seen = new Set(prev.map((t) => `${t.kind || 'p2p'}-${t.id}`))
          return [
            ...prev,
            ...list.filter((t) => !seen.has(`${t.kind || 'p2p'}-${t.id}`)),
          ]
        })
      } else {
        setTransactions(list)
      }

      if (pageNum === 1) {
        try {
          const statsData = await getHistory({ limit: 1 })
          if (statsData?.stats) {
            setStats(normalizeWalletHistoryStats(statsData.stats))
          }
        } catch {
          // ignore — do not blank the recent list if legacy stats fail
        }
      }

      setHasMore(list.length === 20 && pageNum < (pages || 1))
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

  // Reload when user lands on home / history / profile (including back from cashout)
  useEffect(() => {
    if (
      pathname === '/wallet/home' ||
      pathname === '/wallet/history' ||
      pathname === '/wallet/profile'
    ) {
      refresh()
    }
  }, [pathname, refresh])

  // App / tab focus (common after completing a trade elsewhere)
  useEffect(() => {
    const onFocus = () => {
      if (
        pathname === '/wallet/home' ||
        pathname === '/wallet/history' ||
        pathname === '/wallet/profile'
      ) {
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
