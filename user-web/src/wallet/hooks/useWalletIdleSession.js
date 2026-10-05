import { useEffect, useRef } from 'react'
import { useAuth, ROLE_WALLET } from '../../context/AuthContext'
import { getPreference, setPreference } from '../utils/storage'
import { WALLET_IDLE_TIMEOUT_MS, WALLET_LAST_ACTIVE_KEY } from '../utils/constants'

export async function markWalletActive() {
  await setPreference(WALLET_LAST_ACTIVE_KEY, String(Date.now()))
}

export async function walletSessionIsIdle() {
  const raw = await getPreference(WALLET_LAST_ACTIVE_KEY)
  const last = Number(raw)
  if (!Number.isFinite(last)) return true
  return Date.now() - last >= WALLET_IDLE_TIMEOUT_MS
}

/**
 * After 5 minutes with no taps, or that long in the background, pause the
 * session so the person has to sign in again. The wallet key stays on device.
 */
export default function useWalletIdleSession() {
  const { isAuthenticated, role, sessionLocked, lockSession } = useAuth()
  const lastActiveRef = useRef(Date.now())
  const lastPersistRef = useRef(0)
  const lockingRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || role !== ROLE_WALLET || sessionLocked) return undefined

    lockingRef.current = false
    lastActiveRef.current = Date.now()
    lastPersistRef.current = Date.now()
    markWalletActive()

    const bump = () => {
      const now = Date.now()
      lastActiveRef.current = now
      if (now - lastPersistRef.current > 10000) {
        lastPersistRef.current = now
        markWalletActive()
      }
    }

    const expireIfNeeded = () => {
      if (lockingRef.current) return
      if (Date.now() - lastActiveRef.current < WALLET_IDLE_TIMEOUT_MS) return
      lockingRef.current = true
      lockSession()
    }

    const onActivity = () => bump()
    const events = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))

    const onVis = () => {
      if (document.hidden) {
        setPreference(WALLET_LAST_ACTIVE_KEY, String(lastActiveRef.current))
        return
      }
      expireIfNeeded()
    }
    document.addEventListener('visibilitychange', onVis)

    const tick = window.setInterval(() => {
      if (!document.hidden) expireIfNeeded()
    }, 15000)

    return () => {
      events.forEach((name) => window.removeEventListener(name, onActivity))
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(tick)
    }
  }, [isAuthenticated, role, sessionLocked, lockSession])
}
