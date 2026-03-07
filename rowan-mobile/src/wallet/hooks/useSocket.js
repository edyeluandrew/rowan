import { useEffect, useCallback } from 'react'
import { useSocketContext } from '../context/SocketContext'

/**
 * Subscribe to WebSocket events with automatic cleanup.
 */
export default function useSocket(event, handler) {
  const { on, off } = useSocketContext()

  const stableHandler = useCallback(handler, [handler])

  useEffect(() => {
    if (!event) return
    on(event, stableHandler)
    return () => off(event, stableHandler)
  }, [event, stableHandler, on, off])
}
