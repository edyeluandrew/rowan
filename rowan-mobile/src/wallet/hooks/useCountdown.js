import { useState, useEffect, useRef } from 'react'

/**
 * Countdown hook — counts down to a target date/time.
 * Returns { remaining, isExpired, formatted }.
 */
export default function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() => calcRemaining(expiresAt))
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!expiresAt) return
    setRemaining(calcRemaining(expiresAt))

    intervalRef.current = setInterval(() => {
      const r = calcRemaining(expiresAt)
      setRemaining(r)
      if (r <= 0) clearInterval(intervalRef.current)
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [expiresAt])

  const isExpired = remaining <= 0

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`

  return { remaining, isExpired, formatted }
}

function calcRemaining(expiresAt) {
  if (!expiresAt) return 0
  const diff = Math.floor((new Date(expiresAt) - new Date()) / 1000)
  return Math.max(0, diff)
}
