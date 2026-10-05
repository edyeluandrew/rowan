/**
 * Optional extra lock for people who turn biometrics on in settings.
 * The wallet session timeout is separate and always asks them to sign in again.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getPreference, setPreference } from '../utils/storage'

const BiometricLockContext = createContext(null)

export function BiometricLockProvider({ children }) {
  const [isLocked, setIsLocked] = useState(false)
  const [lockRequired, setLockRequired] = useState(false)
  const [lastUnlockTime, setLastUnlockTime] = useState(null)
  const [timeout, setTimeoutSec] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const biometricEnabled = await getPreference('rowan_biometric_enabled')
        const timeoutSetting = await getPreference('rowan_biometric_timeout')
        if (biometricEnabled === 'true') {
          setLockRequired(true)
          setTimeoutSec(parseInt(timeoutSetting || '0', 10))
        }
      } catch {
        /* preferences unavailable */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!lockRequired) return undefined
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (!lastUnlockTime) {
        setIsLocked(true)
        return
      }
      const elapsedSeconds = (Date.now() - lastUnlockTime) / 1000
      if (timeout === 0 || elapsedSeconds > timeout) setIsLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [lockRequired, timeout, lastUnlockTime])

  const unlock = useCallback(() => {
    setLastUnlockTime(Date.now())
    setIsLocked(false)
  }, [])

  const lock = useCallback(() => {
    setIsLocked(true)
    setLastUnlockTime(null)
  }, [])

  const enableLock = useCallback(async (timeoutSeconds = 0) => {
    await setPreference('rowan_biometric_enabled', 'true')
    await setPreference('rowan_biometric_timeout', String(timeoutSeconds))
    setLockRequired(true)
    setTimeoutSec(timeoutSeconds)
    lock()
  }, [lock])

  const disableLock = useCallback(async () => {
    await setPreference('rowan_biometric_enabled', 'false')
    setLockRequired(false)
    setIsLocked(false)
    setLastUnlockTime(null)
  }, [])

  return (
    <BiometricLockContext.Provider
      value={{
        isLocked,
        lockRequired,
        timeout,
        loading,
        unlock,
        lock,
        forceLock: lock,
        markUnlocked: unlock,
        updateTimeout: setTimeoutSec,
        enableLock,
        disableLock,
      }}
    >
      {children}
    </BiometricLockContext.Provider>
  )
}

export function useBiometricLock() {
  const ctx = useContext(BiometricLockContext)
  if (!ctx) throw new Error('useBiometricLock must be inside BiometricLockProvider')
  return ctx
}
