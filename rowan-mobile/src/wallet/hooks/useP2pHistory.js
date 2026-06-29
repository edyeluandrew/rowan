import { useState, useEffect, useCallback } from 'react'
import { getTransactionHistory } from '../api/user'
import { normalizeP2pHistoryResponse } from '../utils/transactions'
import { useSocketContext } from '../context/SocketContext'

const REFRESH_EVENTS = [
  'transaction_complete',
  'transaction_update',
  'transaction_refunded',
  'trader_matched',
  'dispute_opened',
  'dispute_resolved',
]

export default function useP2pHistory(initialFilters = {}) {
  const { on, off } = useSocketContext()
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(initialFilters)

  const fetchPage = useCallback(async (pageNum = 1, append = false, activeFilters = filters) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const params = { page: pageNum, limit: 20 }
      if (activeFilters.status && activeFilters.status !== 'all') {
        params.status = activeFilters.status
      }
      if (activeFilters.range && activeFilters.range !== 'all') {
        params.range = activeFilters.range
      }
      const data = normalizeP2pHistoryResponse(await getTransactionHistory(params))
      setTransactions((prev) => (append ? [...prev, ...data.transactions] : data.transactions))
      setTotal(data.total)
      setPage(data.page)
      setPages(data.pages)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load history')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [filters])

  const refresh = useCallback(() => fetchPage(1, false), [fetchPage])

  const loadMore = useCallback(() => {
    if (page < pages && !loadingMore && !loading) {
      fetchPage(page + 1, true)
    }
  }, [fetchPage, page, pages, loadingMore, loading])

  const updateFilters = useCallback((next) => {
    setFilters(next)
    fetchPage(1, false, next)
  }, [fetchPage])

  useEffect(() => {
    fetchPage(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => refresh()
    REFRESH_EVENTS.forEach((evt) => on(evt, handler))
    return () => REFRESH_EVENTS.forEach((evt) => off(evt, handler))
  }, [on, off, refresh])

  return {
    transactions,
    total,
    page,
    pages,
    loading,
    loadingMore,
    error,
    filters,
    hasMore: page < pages,
    loadMore,
    refresh,
    updateFilters,
  }
}
