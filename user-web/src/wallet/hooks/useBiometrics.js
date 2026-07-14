/**
 * Web stub — biometrics unavailable in browser.
 */
import { useState, useCallback } from 'react'

export default function useBiometrics() {
  const [available] = useState(false)
  const [biometricType] = useState(null)

  const authenticate = useCallback(async () => {
    throw new Error('Biometrics are not available on web')
  }, [])

  return {
    available,
    biometricType,
    authenticate,
    loading: false,
  }
}
