import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDisputes } from '../../../shared/services/api/disputes'
import { handleDataError } from '../../../shared/hooks/useDataFetch'
import { useDisputeStream } from '../../../shared/hooks/useAdminRealTime'

export default function useDisputes(filters = {}) {
  const [httpData, setHttpData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
  const { disputes: streamData, isConnected } = useDisputeStream()

  // Use real-time stream if connected
  const data = useMemo(() => {
    if (isConnected && streamData.length > 0) {
      return streamData.filter((dispute) => {
        if (filters.status && dispute.status !== filters.status) return false
        return true
      })
    }
    return httpData
  }, [streamData, httpData, filters, isConnected])

  const refresh = useCallback(async (pageNum = pagination.page) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getDisputes({ ...filters, page: pageNum })
      setHttpData(result.disputes || result.data || [])
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
