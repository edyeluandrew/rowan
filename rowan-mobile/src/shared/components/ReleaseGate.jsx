/**
 * Confirms the person in front of the device before USDC moves.
 * Uses the lock already on the phone: fingerprint, face, or the device PIN.
 * Rowan does not ask anyone to create a new PIN.
 */
import { useEffect, useRef, useState } from 'react'

async function deviceLockAvailable() {
  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable({ useFallback: true })
    return Boolean(result?.isAvailable || result?.deviceIsSecure)
  } catch {
    return false
  }
}

async function verifyDeviceLock(reason) {
  const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
  await NativeBiometric.verifyIdentity({
    reason: reason || 'Confirm this USDC release',
    title: 'Rowan',
    subtitle: 'Fingerprint, face, or device PIN',
    useFallback: true,
    maxAttempts: 5,
  })
}

export default function ReleaseGate({ open, title = 'Confirm this USDC release', onCancel, onConfirmed }) {
  const [error, setError] = useState('')
  const onConfirmedRef = useRef(onConfirmed)
  onConfirmedRef.current = onConfirmed

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setError('')
    ;(async () => {
      const available = await deviceLockAvailable()
      if (cancelled) return
      if (!available) {
        onConfirmedRef.current()
        return
      }
      try {
        await verifyDeviceLock(title)
        if (!cancelled) onConfirmedRef.current()
      } catch {
        if (!cancelled) setError('Confirm with fingerprint, face, or this device PIN')
      }
    })()
    return () => { cancelled = true }
  }, [open, title])

  if (!open || !error) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="bg-rowan-surface border border-rowan-border rounded-2xl w-full max-w-sm p-5">
        <p className="text-rowan-text font-semibold">{title}</p>
        <p className="text-rowan-muted text-sm mt-1">{error}</p>
        <button
          type="button"
          onClick={async () => {
            setError('')
            try {
              await verifyDeviceLock(title)
              onConfirmed()
            } catch {
              setError('Confirm with fingerprint, face, or this device PIN')
            }
          }}
          className="mt-4 w-full min-h-11 rounded-xl bg-[#FCD535] text-[#181A20] font-semibold"
        >
          Try again
        </button>
        <button type="button" onClick={onCancel} className="mt-3 w-full text-rowan-muted text-sm min-h-9">
          Cancel
        </button>
      </div>
    </div>
  )
}
