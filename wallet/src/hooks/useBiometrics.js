import { useState, useEffect, useCallback } from 'react'
import { getPreference, setPreference } from '../utils/storage'

/**
 * Asks this device to confirm the person in front of it.
 * Uses the lock already on the phone: PIN, pattern, fingerprint, or face.
 * Rowan does not create a passkey.
 */
const DEVICE_LOCK_TYPES = [3, 4, 5, 7]

function mapNativeType(biometryType) {
  if (biometryType === 1) return 'TOUCH_ID'
  if (biometryType === 2 || biometryType === 4) return 'FACE_ID'
  if (biometryType === 3) return 'FINGERPRINT'
  if (biometryType === 7) return 'DEVICE_PIN'
  return 'DEVICE_LOCK'
}

export default function useBiometrics() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [biometricType, setBiometricType] = useState('NONE')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
        const result = await NativeBiometric.isAvailable({ useFallback: true })
        if (!cancelled) {
          setIsAvailable(Boolean(result.isAvailable || result.deviceIsSecure))
          setBiometricType(mapNativeType(result.biometryType))
        }
      } catch {
        if (!cancelled) setIsAvailable(false)
      }

      try {
        const stored = await getPreference('rowan_biometric_enabled')
        const storedType = await getPreference('rowan_biometric_type')
        if (!cancelled) {
          setIsEnabled(stored === 'true')
          if (storedType) setBiometricType(storedType)
        }
      } catch {
        /* preferences read failure */
      }

      if (!cancelled) setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [])

  const authenticate = useCallback(async (reason) => {
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
      await NativeBiometric.verifyIdentity({
        reason: reason || 'Confirm it is you',
        title: 'Rowan',
        subtitle: "Use this device's screen lock",
        useFallback: true,
        maxAttempts: 5,
        allowedBiometryTypes: DEVICE_LOCK_TYPES,
      })
      return true
    } catch {
      return false
    }
  }, [])

  const enable = useCallback(async () => {
    const verified = await authenticate('Confirm your identity to enable biometrics')
    if (verified) {
      await setPreference('rowan_biometric_enabled', 'true')
      await setPreference('rowan_biometric_type', biometricType)
      setIsEnabled(true)
    }
    return verified
  }, [authenticate, biometricType])

  const disable = useCallback(async () => {
    await setPreference('rowan_biometric_enabled', 'false')
    setIsEnabled(false)
  }, [])

  return { isAvailable, isEnabled, biometricType, loading, authenticate, enable, disable }
}
