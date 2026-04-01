import { useState, useEffect, useCallback, useMemo } from 'react'
import { getTraders } from '../../../shared/services/api/traders'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useTraderStream } from '../../../shared/hooks/useAdminRealTime'

export default function useTraders(filters = {}) {
  const [httpData, setHttpData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const { traders: streamData, isConnected } = useTraderStream()

  // Use real-time stream if connected, otherwise use HTTP
  const data = useMemo(() => {
    if (isConnected && streamData.length > 0) {
      // Filter real-time stream based on filters
      return streamData.filter((trader) => {
        if (filters.status && trader.verification_status !== filters.status && trader.status !== filters.status) return false
        if (filters.search) {
          const s = filters.search.toLowerCase()
          if (!trader.name?.toLowerCase().includes(s) && !trader.email?.toLowerCase().includes(s)) return false
        }
        return true
      })
    }
    return httpData
  }, [streamData, httpData, filters, isConnected])

  const refresh = useCallback(async (pageNum = pagination.page) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getTraders({ ...filters, page: pageNum })
      setHttpData(result.traders || result.data || [])
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
