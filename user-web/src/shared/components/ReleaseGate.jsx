/**
 * Website release step. This browser has no device fingerprint prompt,
 * so the sell continues without asking anyone to create a PIN.
 * The phone app uses the lock already on the device.
 */
import { useEffect, useRef } from 'react'

export default function ReleaseGate({ open, onConfirmed }) {
  const onConfirmedRef = useRef(onConfirmed)
  onConfirmedRef.current = onConfirmed

  useEffect(() => {
    if (!open) return undefined
    onConfirmedRef.current()
    return undefined
  }, [open])

  return null
}
