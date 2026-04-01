import { useEffect, useCallback, useRef } from 'react'
import { useSocket } from '../context/SocketContext'

/**
 * Hook for auto-refreshing data at intervals
 * Automatically stops interval on unmount
 */
export const useAutoRefresh = (refreshFn, intervalMs = 5000, dependencies = []) => {
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!refreshFn) return

    refreshFn()
    intervalRef.current = setInterval(refreshFn, intervalMs)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshFn, intervalMs, ...dependencies])

  return {
    stop: () => clearInterval(intervalRef.current),
    start: () => {
      if (refreshFn) {
        refreshFn()
        intervalRef.current = setInterval(refreshFn, intervalMs)
      }
    },
  }
}

/**
 * Hook for listening to socket events and refreshing data
 */
export const useSocketRefresh = (refreshFn, socketEvents = []) => {
  const { on, off } = useSocket()

  useEffect(() => {
    if (!refreshFn || socketEvents.length === 0) return

    const handleRefresh = () => {
      refreshFn()
    }

    socketEvents.forEach((event) => {
      on(event, handleRefresh)
    })

    return () => {
      socketEvents.forEach((event) => {
        off(event, handleRefresh)
      })
    }
  }, [refreshFn, socketEvents, on, off])
}

/**
 * Retry logic for failed requests
 */
export const useRetry = (fn, maxRetries = 3, retryDelayMs = 1000) => {
  const retriesRef = useRef(0)

  const execute = useCallback(async (...args) => {
    let lastError
    for (let i = 0; i < maxRetries; i++) {
      try {
        retriesRef.current = i
        return await fn(...args)
      } catch (error) {
        lastError = error
        if (i < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs * Math.pow(2, i))
          )
        }
      }
    }
    throw lastError
  }, [fn, maxRetries, retryDelayMs])

  return { execute, retries: retriesRef.current }
}

/**
 * Cache hook for storing previously fetched data
 * Reduces API calls for same queries
 */
export const useCache = (maxSize = 50) => {
  const cacheRef = useRef(new Map())

  const getCache = useCallback((key) => {
    return cacheRef.current.get(key)
  }, [])

  const setCache = useCallback((key, value) => {
    if (cacheRef.current.size >= maxSize) {
      const firstKey = cacheRef.current.keys().next().value
      cacheRef.current.delete(firstKey)
    }
    cacheRef.current.set(key, value)
  }, [maxSize])

  const clearCache = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  const isCached = useCallback((key) => {
    return cacheRef.current.has(key)
  }, [])

  return { getCache, setCache, clearCache, isCached }
}
