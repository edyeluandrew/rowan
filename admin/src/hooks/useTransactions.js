import { useState, useEffect, useCallback } from 'react'
import { getTransactions } from '../api/transactions'

export default function useTransactions(filters = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)

  const fetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getTransactions({ ...filters, page })
      setData(result.transactions || [])
      setTotal(result.total || 0)
      setPages(result.pages || 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, JSON.stringify(filters)])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, total, pages, page, setPage, refresh: fetch }
}
