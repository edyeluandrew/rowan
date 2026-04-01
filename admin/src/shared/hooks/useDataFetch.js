import { useState, useCallback } from 'react'

/**
 * Standard error handler for data fetching
 * Formats errors consistently across all hooks
 */
export const handleDataError = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  if (error.message) {
    return error.message
  }
  return 'An error occurred while fetching data'
}

/**
 * Hook factory for creating consistent data-fetching hooks
 */
export const useDataFetch = (fetcher, defaultData = null, onError = null) => {
  const [data, setData] = useState(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async (params) => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetcher(params)
      setData(result)
    } catch (err) {
      const errorMsg = handleDataError(err)
      setError(errorMsg)
      if (onError) onError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [fetcher, onError])

  return { data, loading, error, fetch, refetch: fetch, setData }
}

/**
 * Hook for list data with pagination
 */
export const useListData = (fetcher, defaultData = []) => {
  const [data, setData] = useState(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

  const fetch = useCallback(async (filter = {}, pageNum = 1) => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetcher({ ...filter, page: pageNum })
      setData(result.data || result.items || result.transactions || [])
      setPagination({
        page: result.page || pageNum,
        pages: result.pages || 1,
        total: result.total || 0,
      })
    } catch (err) {
      const errorMsg = handleDataError(err)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [fetcher])

  return { data, loading, error, ...pagination, fetch, refetch: fetch, setPagination }
}

/**
 * Hook for toggling between multiple states (loading, success, error)
 * Used for UI-triggered actions like save, delete, approve
 */
export const useAsyncAction = (asyncFn) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(false)
      const result = await asyncFn(...args)
      setSuccess(true)
      return result
    } catch (err) {
      const errorMsg = handleDataError(err)
      setError(errorMsg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [asyncFn])

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
    setLoading(false)
  }, [])

  return { execute, loading, error, success, reset }
}
