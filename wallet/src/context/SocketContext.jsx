import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { SOCKET_RECONNECT_ATTEMPTS, SOCKET_RECONNECT_DELAY, SOCKET_RECONNECT_DELAY_MAX } from '../utils/constants'
import { getPreference } from '../utils/storage'
import { scheduleLocalNotification } from '../utils/notifications'
import { onLogout } from '../api/client'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { token, isAuthenticated, user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)
  const audioCtxRef = useRef(null)

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
      if (user?.id) {
        socket.emit('join', `user:${user.id}`)
      }
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    socket.on('transaction_complete', (data) => {
      playNotification()
      scheduleLocalNotification({
        id: Date.now(),
        title: '\uD83D\uDCB0 Payment received!',
        body: 'Mobile money has been sent to the recipient.',
        data,
      })
    })
    socket.on('transaction_refunded', (data) => {
      playNotification()
      scheduleLocalNotification({
        id: Date.now() + 1,
        title: '\u21A9\uFE0F Refund processed',
        body: 'Your XLM has been refunded to your wallet.',
        data,
      })
    })
    socket.on('trader_matched', (data) => {
      playNotification()
      scheduleLocalNotification({
        id: Date.now() + 2,
        title: '\uD83E\uDD1D Trader matched',
        body: 'A trader has been assigned to your cashout.',
        data,
      })
    })

    socketRef.current = socket

    // Disconnect socket when a 401 logout occurs
    const unregister = onLogout(() => {
      socket.disconnect()
      socketRef.current = null
    })

    return () => {
      unregister()
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, token, user?.id])

  const playNotification = useCallback(async () => {
    try {
      const soundEnabled = await getPreference('rowan_user_sound_enabled')
      const vibrationEnabled = await getPreference('rowan_user_vibration_enabled')

      if (soundEnabled !== 'false') {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
        }
        const ctx = audioCtxRef.current
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()
        oscillator.connect(gain)
        gain.connect(ctx.destination)
        oscillator.frequency.value = 880
        oscillator.type = 'sine'
        gain.gain.value = 0.1
        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.15)
      }

      if (vibrationEnabled !== 'false' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100])
      }
    } catch {
      /* notification sound/vibration not available */
    }
  }, [])

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, on, off }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider')
  return ctx
}
