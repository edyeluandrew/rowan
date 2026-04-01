import { useState, useEffect, useCallback } from 'react'
import { getTransactions } from '../../../shared/services/api/transactions'
import { handleDataError } from '../../../shared/hooks/useDataFetch'

export default function useTransactions(filters = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const refresh = useCallback(async (pageNum = pagination.page) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getTransactions({ ...filters, page: pageNum })
      setData(result.transactions || result.data || [])
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
  }
}
