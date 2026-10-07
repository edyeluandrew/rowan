/**
 * On a PC or phone browser, Sign in asks Windows Hello, Touch ID, or the device PIN.
 * The check is tied to this device. Rowan does not offer Google Password Manager.
 */
import { useState, useEffect, useCallback } from 'react'
import { getPreference, setPreference } from '../utils/storage'

const LOCK_KEY = 'rowan_device_lock_id'

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
  return 'DEVICE_LOCK'
}

export function biometricLabel(type) {
  if (type === 'FACE_ID') return 'Face ID'
  if (type === 'TOUCH_ID') return 'Touch ID'
  if (type === 'WINDOWS_HELLO') return 'Windows Hello'
  if (type === 'FINGERPRINT') return 'fingerprint'
  if (type === 'DEVICE_PIN') return 'device PIN'
  return "this device's lock"
}

function creationOptions(challenge) {
  return {
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
      residentKey: 'required',
      requireResidentKey: true,
    },
    hints: ['client-device'],
    attestation: 'none',
    timeout: 60000,
  }
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
        /* this browser cannot ask the device lock */
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
    const existing = await getPreference(LOCK_KEY)

    if (existing) {
      try {
        const result = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            hints: ['client-device'],
            allowCredentials: [{
              type: 'public-key',
              id: b64ToBytes(existing),
              transports: ['internal'],
            }],
          },
        })
        return Boolean(result)
      } catch (err) {
        if (err?.name !== 'InvalidStateError' && err?.name !== 'NotFoundError') return false
        await setPreference(LOCK_KEY, '')
      }
    }

    try {
      const created = await navigator.credentials.create({
        publicKey: creationOptions(crypto.getRandomValues(new Uint8Array(32))),
      })
      if (!created) return false
      await setPreference(LOCK_KEY, bytesToB64(new Uint8Array(created.rawId)))
      return true
    } catch {
      return false
    }
  }, [])

  const enable = useCallback(async () => {
    const ok = await authenticate()
    if (ok) {
      await setPreference('rowan_biometric_enabled', 'true')
      await setPreference('rowan_biometric_type', biometricType || 'DEVICE_LOCK')
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
