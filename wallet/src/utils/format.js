/**
 * Formatting utilities shared across the wallet app.
 */

/**
 * Format a fiat currency amount with locale grouping.
 * 4521.50 → UGX 4,522
 */
export function formatCurrency(amount, currency = 'UGX') {
  const num = Number(amount) || 0
  const decimals = currency === 'UGX' || currency === 'TZS' ? 0 : 2
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${currency} ${formatted}`
}

/**
 * Format XLM amount — always 2 decimal places, never scientific.
 * 45.2319847 → 45.23 XLM
 */
export function formatXlm(amount) {
  const num = Number(amount) || 0
  return `${num.toFixed(2)} XLM`
}

/**
 * Format USDC amount — always 2 decimal places.
 * 45.20 → 45.20 USDC
 */
export function formatUsdc(amount) {
  const num = Number(amount) || 0
  return `${num.toFixed(2)} USDC`
}

/**
 * Format exchange rate for display.
 * 1 XLM = UGX 4,521
 */
export function formatRate(rateValue, currency = 'UGX') {
  const num = Number(rateValue) || 0
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `1 XLM = ${currency} ${formatted}`
}

/**
 * Format a date for display. 2024-01-15 → Jan 15, 2024
 */
export function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format date and time. Jan 15, 2024 at 3:45 PM
 */
export function formatDateTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${formatDate(dateString)} at ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

/**
 * Relative time ago. 2 min ago, 3h ago, etc.
 */
export function formatTimeAgo(dateString) {
  if (!dateString) return ''
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateString)
}

/**
 * Truncate a Stellar address for UI. GABCD...WXYZ
 */
export function formatAddress(address) {
  if (!address || address.length < 16) return address || ''
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}
