import { formatCurrency } from './format'
import { NETWORKS } from './constants'

/** Human readable transaction status — never show raw state enums in UI */
export const USER_STATUS_LABELS = {
  QUOTE_REQUESTED: 'Getting your rate...',
  QUOTE_CONFIRMED: 'Rate confirmed',
  ESCROW_LOCKED: 'XLM secured',
  TRADER_MATCHED: 'Trader found',
  FIAT_PAYOUT_SUBMITTED: 'Payment sent to you',
  USER_CONFIRMATION_PENDING: 'Confirm your payment',
  COMPLETE: 'Done!',
  DISPUTE_OPENED: 'Under review',
  DISPUTE_RELEASE_PENDING: 'Under review',
  DISPUTE_REFUND_PENDING: 'Under review',
  RELEASE_BLOCKED: 'Needs attention',
  REFUNDED: 'Refunded',
  FAILED: 'Transaction failed',
}

export function getStatusLabel(state) {
  if (!state) return 'Processing'
  return USER_STATUS_LABELS[state] || 'Processing'
}

/** e.g. 98.5% */
export function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return null
  return `${Number(value).toFixed(1)}%`
}

/** e.g. "4 mins", "1 min" */
export function formatDurationMinutes(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return null
  const m = Math.round(Number(minutes))
  if (m <= 0) return 'Under 1 min'
  return m === 1 ? '1 min' : `${m} mins`
}

/** Human-readable order reference: ROW-A1B2C3D4 */
export function formatShortId(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') return 'ROW-????????'
  return `ROW-${transactionId.replace(/-/g, '').substring(0, 8).toUpperCase()}`
}

/** e.g. "UGX 3,680 per XLM" for rate lock display */
export function formatLockedRateLine(currency, rate) {
  if (!currency || rate == null || !Number.isFinite(Number(rate))) return null
  const formatted = Number(rate).toLocaleString('en-US', { maximumFractionDigits: 0 })
  return `${currency} ${formatted} per XLM`
}

/** e.g. "1 XLM = UGX 3,680" */
export function formatXlmRateLine(currency, rate) {
  if (!currency || rate == null || !Number.isFinite(Number(rate))) return null
  const formatted = Number(rate).toLocaleString('en-US', { maximumFractionDigits: 0 })
  return `1 XLM = ${currency} ${formatted}`
}

/** e.g. "1 USDC ≈ UGX 3,728" — trader-set buy price */
export function formatUsdcRateLine(currency, ratePerUsdc) {
  if (!currency || ratePerUsdc == null || !Number.isFinite(Number(ratePerUsdc))) return null
  const formatted = Number(ratePerUsdc).toLocaleString('en-US', { maximumFractionDigits: 2 })
  return `1 USDC ≈ ${currency} ${formatted}`
}

/** e.g. "10:34 AM" */
export function formatMessageTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  if (!Number.isFinite(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function getNetworkLabel(networkKey) {
  return NETWORKS[networkKey]?.label || 'Mobile Money'
}

export function getTraderDisplayName(name) {
  const trimmed = (name || '').trim()
  return trimmed || 'Verified Trader'
}

export function lookupNetworkRate(allRates, network) {
  if (!allRates || !network) return null
  if (Array.isArray(allRates)) {
    const row = allRates.find((r) => r.network === network)
    return row?.rate ?? null
  }
  return allRates[network]?.rate ?? allRates[network] ?? null
}

export { formatCurrency }
