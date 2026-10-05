/**
 * Keep a typed amount as digits and at most one decimal point.
 * Letters, spaces, and symbols are dropped.
 */
export function sanitizeAmount(raw, { decimals = 2 } = {}) {
  if (raw == null) return ''
  const cleaned = String(raw).replace(/[^\d.]/g, '')
  if (decimals <= 0) return cleaned.replace(/\./g, '')

  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned

  const whole = cleaned.slice(0, dot)
  const frac = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, decimals)
  return `${whole}.${frac}`
}
