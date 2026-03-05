/**
 * Formatting utilities for the Rowan Admin Panel.
 */

/**
 * Format XLM amount — always 2 decimal places.
 */
export function formatXlm(amount) {
  const num = Number(amount) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Format USDC amount — always 2 decimal places.
 */
export function formatUsdc(amount) {
  const num = Number(amount) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Format fiat currency.
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
 * Format a date to locale date string.
 */
export function formatDate(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date/time to locale datetime string.
 */
export function formatDateTime(dateString) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format as relative time ago.
 */
export function formatTimeAgo(dateString) {
  if (!dateString) return '—'
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const seconds = Math.floor((now - then) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(dateString)
}

/**
 * Truncate a Stellar address or hash: GABCD...WXYZ
 */
export function formatAddress(address) {
  if (!address || address.length < 16) return address || '—'
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

/**
 * Format a percentage value.
 */
export function formatPercent(value) {
  const num = Number(value) || 0
  return `${num.toFixed(1)}%`
}

/**
 * Format a number with locale thousands separator.
 */
export function formatNumber(value) {
  const num = Number(value) || 0
  return num.toLocaleString('en-US')
}
