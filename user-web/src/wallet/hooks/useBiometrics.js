/**
 * The website does not ask the browser for a passkey.
 * Chrome turns that request into "save a passkey" and offers Google Password Manager,
 * then the save can fail after the fingerprint. The phone app asks for the phone lock instead.
 */
import { useState, useEffect, useCallback } from 'react'
import { setPreference } from '../utils/storage'

export function biometricLabel(type) {
  if (type === 'FACE_ID') return 'Face ID'
  if (type === 'TOUCH_ID') return 'Touch ID'
  if (type === 'WINDOWS_HELLO') return 'Windows Hello'
  if (type === 'FINGERPRINT') return 'fingerprint'
  if (type === 'DEVICE_PIN') return 'device PIN'
  return "this device's lock"
}

export default function useBiometrics() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await setPreference('rowan_platform_credential_id', '')
        await setPreference('rowan_device_lock_id', '')
        await setPreference('rowan_biometric_enabled', 'false')
      } catch {
        /* preferences unavailable */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const authenticate = useCallback(async () => true, [])

  const enable = useCallback(async () => false, [])

  const disable = useCallback(async () => {
    await setPreference('rowan_biometric_enabled', 'false')
  }, [])

  return {
    available: false,
    isAvailable: false,
    isEnabled: false,
    biometricType: null,
    authenticate,
    enable,
    disable,
    loading,
    requiresGesture: true,
  }
}
