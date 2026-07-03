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

/** e.g. "Joined Jun 2024" */
export function formatMemberSince(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  if (!Number.isFinite(d.getTime())) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `Joined ${months[d.getMonth()]} ${d.getFullYear()}`
}

/** e.g. "Usually under 10 min" — platform typical trade duration */
export function formatTypicalTradeTime(minutes) {
  const m = Number(minutes)
  if (!Number.isFinite(m) || m <= 0) return null
  return m === 1 ? 'Usually under 1 min' : `Usually under ${m} min`
}

/** e.g. "Avg. payout: 4 min" */
export function formatAvgReleaseTime(minutes) {
  const formatted = formatDurationMinutes(minutes)
  if (!formatted) return null
  return `Avg. payout: ${formatted}`
}

/** e.g. "42 trades" */
export function formatTradeCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n) || n < 0) return null
  if (n === 0) return 'No trades yet'
  return n === 1 ? '1 trade' : `${n.toLocaleString()} trades`
}

/** Rough USDC per XLM from fiat rates */
export function estimateUsdcPerXlm(xlmRate, usdcToFiat) {
  const xlm = Number(xlmRate)
  const usdc = Number(usdcToFiat)
  if (!Number.isFinite(xlm) || !Number.isFinite(usdc) || usdc <= 0) return null
  return xlm / usdc
}

/** e.g. "With 10 XLM → ~UGX 36,400" */
export function formatSellEstimateLine(xlmAmount, fiatAmount, currency) {
  const xlm = Number(xlmAmount)
  const fiat = Number(fiatAmount)
  if (!Number.isFinite(xlm) || !Number.isFinite(fiat) || !currency) return null
  const fiatFmt = Math.round(fiat).toLocaleString('en-US')
  const xlmFmt = Number.isInteger(xlm) ? String(xlm) : xlm.toFixed(1)
  return `With ${xlmFmt} XLM → ~${currency} ${fiatFmt}`
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
