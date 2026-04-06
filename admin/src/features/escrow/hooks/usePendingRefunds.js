import { useState, useEffect, useCallback } from 'react'
import { getPendingRefunds } from '../../../shared/services/api/escrow'

export default function usePendingRefunds(filters = { limit: 50, offset: 0 }) {
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 50, offset: 0 })

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getPendingRefunds(filters)
      setRefunds(result.refunds || [])
      setPagination({
        total: result.total || 0,
        pages: result.pages || 1,
        limit: result.limit || 50,
        offset: result.offset || 0,
      })
    } catch (err) {
      setError(err?.message || 'Failed to fetch pending refunds')
      setRefunds([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    refresh()
  }, [JSON.stringify(filters)])

  return {
    refunds,
    loading,
    error,
    total: pagination.total,
    pages: pagination.pages,
    limit: pagination.limit,
    offset: pagination.offset,
    refresh,
  }
}
