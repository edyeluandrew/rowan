import { useState, useEffect, useCallback } from 'react'
import { getPreference, setPreference } from '../utils/storage'

/**
 * Hook to manage biometric authentication (Face ID / Fingerprint).
 * Uses @capgo/capacitor-native-biometric under the hood.
 */
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
        const result = await NativeBiometric.isAvailable()
        if (!cancelled) {
          setIsAvailable(result.isAvailable)
          const type = result.biometryType === 1 ? 'FACE_ID' : 'FINGERPRINT'
          setBiometricType(type)
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
        reason,
        title: 'Rowan Authentication',
        subtitle: reason,
        description: '',
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
