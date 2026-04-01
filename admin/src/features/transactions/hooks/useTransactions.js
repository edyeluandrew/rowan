import { useState, useEffect, useCallback, useMemo } from 'react'
import { getTransactions } from '../../../shared/services/api/transactions'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useTransactionStream } from '../../../shared/hooks/useTransactionStream'

export default function useTransactions(filters = {}) {
  const [httpData, setHttpData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const { transactions: streamData, isConnected } = useTransactionStream()

  // Use real-time stream if connected, otherwise use HTTP polling
  const data = useMemo(() => {
    if (isConnected && streamData.length > 0) {
      // Filter real-time stream data based on filters
      return streamData.filter((tx) => {
        if (filters.state && tx.state !== filters.state) return false
        if (filters.currency && tx.fiat_currency !== filters.currency) return false
        return true
      })
    }
    return httpData
  }, [streamData, httpData, filters, isConnected])

  const refresh = useCallback(async (pageNum = pagination.page) => {
    try {
      setLoading(true)
      setError(null)
      // Always fetch from HTTP as fallback, but real-time stream will override
      const result = await getTransactions({ ...filters, page: pageNum })
      setHttpData(result.transactions || result.data || [])
      setPagination({
        page: result.page || pageNum,
        pages: result.pages || 1,
        total: result.total || 0,
      })
    } catch (err) {
      setError(handleDataError(err))
    } finally {
      setLoading(false)
    }
  }, [filters, pagination.page])

  useEffect(() => {
    refresh(1)
  }, [JSON.stringify(filters)])

  const setPage = useCallback((newPage) => {
    refresh(newPage)
  }, [refresh])

  return {
    data,
    loading,
    error,
    total: pagination.total,
    pages: pagination.pages,
    page: pagination.page,
    setPage,
    refresh,
    pagination,
    isRealTime: isConnected,
  }
}
