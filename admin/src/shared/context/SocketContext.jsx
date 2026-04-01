import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { onAdminLogout } from './AuthContext'
import { SOCKET_RECONNECT_ATTEMPTS, SOCKET_RECONNECT_DELAY, SOCKET_RECONNECT_DELAY_MAX } from '../utils/constants'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { token, isAuthenticated } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!isAuthenticated || !token) return

    const socket = io(import.meta.env.VITE_API_URL, {
      auth: { token },
      reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
      reconnectionDelay: SOCKET_RECONNECT_DELAY,
      reconnectionDelayMax: SOCKET_RECONNECT_DELAY_MAX,
    })

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join', 'admin')
    })

    socket.on('disconnect', () => setIsConnected(false))

    socketRef.current = socket

    // Disconnect socket on admin logout (401 or manual)
    const unregister = onAdminLogout(() => {
      socket.disconnect()
      socketRef.current = null
    })

    return () => {
      unregister()
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, token])

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return (
    <SocketContext.Provider value={{ isConnected, on, off }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
