import { useState, useEffect, useCallback } from 'react'
import { getTraders } from '../api/traders'

export default function useTraders(filters = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getTraders({ ...filters, page })
      setData(result.traders || [])
      setTotal(result.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, JSON.stringify(filters)])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, total, page, setPage, refresh: fetch }
}
