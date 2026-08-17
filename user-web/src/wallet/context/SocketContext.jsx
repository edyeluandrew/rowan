import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { SOCKET_RECONNECT_ATTEMPTS, SOCKET_RECONNECT_DELAY, SOCKET_RECONNECT_DELAY_MAX } from '../utils/constants'
import { getPreference } from '../utils/storage'
import { scheduleLocalNotification } from '../utils/notifications'
import { buildLocalNotificationExtra } from '../utils/notificationRoutes'
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
        title: 'Payment received!',
        body: 'Your trade is complete. Open Rowan for the receipt.',
        data: buildLocalNotificationExtra('COMPLETE', data),
      })
    })
    socket.on('transaction_refunded', (data) => {
      playNotification()
      scheduleLocalNotification({
        id: Date.now() + 1,
        title: 'Refund processed',
        body: 'Your USDC has been refunded to your wallet.',
        data: buildLocalNotificationExtra('REFUNDED', data),
      })
    })
    socket.on('trader_matched', (data) => {
      playNotification()
      const provider = String(data?.provider || data?.payout_provider || data?.payoutProvider || '').toLowerCase()
      const automated = ['marz_pay', 'yellow_pay', 'kotani_pay'].includes(provider)
      scheduleLocalNotification({
        id: Date.now() + 2,
        title: automated ? 'Approve on your phone' : 'Trader matched',
        body: automated
          ? 'Check your phone for an MTN or Airtel prompt. Tap to open the order.'
          : 'A trader is handling your order. Tap to open it.',
        data: buildLocalNotificationExtra('TRADER_MATCHED', data),
      })
    })
    socket.on('transaction_update', (data) => {
      const state = String(data?.state || '').toUpperCase()
      const provider = String(data?.provider || data?.payout_provider || data?.payoutProvider || '').toLowerCase()
      const automated = ['marz_pay', 'yellow_pay', 'kotani_pay'].includes(provider)
      if (state === 'FIAT_PAYOUT_SUBMITTED' || state === 'USER_CONFIRMATION_PENDING') {
        playNotification()
        scheduleLocalNotification({
          id: Date.now() + 3,
          title: automated
            ? (state === 'FIAT_PAYOUT_SUBMITTED' ? 'Payout sent' : 'Finishing payout')
            : (state === 'FIAT_PAYOUT_SUBMITTED' ? 'Payout sent' : 'Confirm receipt'),
          body: automated
            ? (state === 'FIAT_PAYOUT_SUBMITTED'
              ? 'Check your phone for mobile money. This order will complete automatically.'
              : 'Your payout is finishing. Stay on this screen.')
            : (state === 'FIAT_PAYOUT_SUBMITTED'
              ? 'Mobile money was submitted. Open your order to confirm.'
              : 'Confirm you received mobile money to finish the trade.'),
          data: buildLocalNotificationExtra(state, data),
        })
      }
    })
    socket.on('dispute_opened', (data) => {
      playNotification()
      scheduleLocalNotification({
        id: Date.now() + 4,
        title: 'Dispute opened',
        body: 'Open your order to review the dispute.',
        data: buildLocalNotificationExtra('DISPUTE_OPENED', data),
      })
    })

    socketRef.current = socket

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

  const joinOrder = useCallback((transactionId) => {
    if (transactionId) {
      socketRef.current?.emit('join_order', { transactionId })
    }
  }, [])

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected, on, off, joinOrder }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocketContext() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocketContext must be used within SocketProvider')
  return ctx
}
