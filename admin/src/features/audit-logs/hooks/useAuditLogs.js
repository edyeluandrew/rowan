import { useState, useEffect, useCallback } from 'react'
import { getAuditLogs } from '../../../shared/services/api/auditLogs'

export default function useAuditLogs(filters = {}) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const refresh = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true)
      setError(null)
      const result = await getAuditLogs({ ...filters, page: pageNum, limit: 50 })
      setLogs(result.logs || result.data || [])
      setPagination({
        page: result.page || pageNum,
        pages: result.pages || 1,
        total: result.total || 0,
      })
    } catch (err) {
      setError(err?.message || 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh(1)
  }, [JSON.stringify(filters)])

  const setPage = useCallback((newPage) => {
    refresh(newPage)
  }, [refresh])

  return {
    logs,
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
