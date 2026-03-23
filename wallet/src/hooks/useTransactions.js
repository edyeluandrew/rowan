import { useState, useEffect, useCallback } from 'react'
import { getHistory } from '../api/user'

/**
 * Hook to fetch paginated transaction history.
 */
export default function useTransactions() {
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
      if (append) {
        setTransactions((prev) => [...prev, ...(data.transactions || [])])
      } else {
        setTransactions(data.transactions || [])
      }
      setStats(data.stats || null)
      setHasMore((data.transactions || []).length === 20)
      setPage(pageNum)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(1)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchPage(page + 1, true)
    }
  }, [fetchPage, page, hasMore, loading])

  const refresh = useCallback(() => fetchPage(1), [fetchPage])

  return { transactions, stats, loading, error, hasMore, loadMore, refresh }
}
