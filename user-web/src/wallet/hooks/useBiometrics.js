/**
 * Detects a platform authenticator (Windows Hello, Touch ID, Face ID, fingerprint)
 * and asks the device to confirm the person in front of it.
 * The check stays on this device. Rowan never receives biometric data.
 */
import { useState, useEffect, useCallback } from 'react'
import { getPreference, setPreference } from '../utils/storage'

const CRED_KEY = 'rowan_platform_credential_id'

function bytesToB64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function b64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function detectType() {
  const ua = navigator.userAgent || ''
  if (/Windows/i.test(ua)) return 'WINDOWS_HELLO'
  if (/iPhone|iPad/i.test(ua)) return 'FACE_ID'
  if (/Macintosh/i.test(ua)) return 'TOUCH_ID'
  if (/Android/i.test(ua)) return 'FINGERPRINT'
  return 'BIOMETRIC'
}

export function biometricLabel(type) {
  if (type === 'FACE_ID') return 'Face ID'
  if (type === 'TOUCH_ID') return 'Touch ID'
  if (type === 'WINDOWS_HELLO') return 'Windows Hello'
  if (type === 'FINGERPRINT') return 'fingerprint'
  return 'biometrics'
}

export default function useBiometrics() {
  const [isAvailable, setIsAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const detect = window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable
        if (detect) {
          const ok = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          if (!cancelled && ok) {
            setIsAvailable(true)
            setBiometricType(detectType())
          }
        }
      } catch {
        /* this browser has no platform authenticator */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const authenticate = useCallback(async () => {
    if (!window.PublicKeyCredential || !navigator.credentials) return false
    const challenge = crypto.getRandomValues(new Uint8Array(32))
    const existing = await getPreference(CRED_KEY)
    try {
      if (existing) {
        const result = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: [{ type: 'public-key', id: b64ToBytes(existing) }],
          },
        })
        return Boolean(result)
      }

      const created = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'Rowan' },
          user: {
            id: crypto.getRandomValues(new Uint8Array(16)),
            name: 'rowan',
            displayName: 'Rowan',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })
      if (!created) return false
      await setPreference(CRED_KEY, bytesToB64(new Uint8Array(created.rawId)))
      return true
    } catch (err) {
      if (existing && (err?.name === 'InvalidStateError' || err?.name === 'NotFoundError')) {
        await setPreference(CRED_KEY, '')
      }
      return false
    }
  }, [])

  const enable = useCallback(async () => {
    const ok = await authenticate()
    if (ok) {
      await setPreference('rowan_biometric_enabled', 'true')
      await setPreference('rowan_biometric_type', biometricType || 'BIOMETRIC')
    }
    return ok
  }, [authenticate, biometricType])

  const disable = useCallback(async () => {
    await setPreference('rowan_biometric_enabled', 'false')
  }, [])

  return {
    available: isAvailable,
    isAvailable,
    isEnabled: false,
    biometricType,
    authenticate,
    enable,
    disable,
    loading,
    requiresGesture: true,
  }
}
