/**
 * Application-wide constants for the Rowan Admin Panel.
 * Keys use lowercase to match backend API response values.
 */

export const TRANSACTION_STATES = {
  QUOTE_REQUESTED: { label: 'Quote Requested', color: 'text-rowan-muted', bg: 'bg-rowan-muted/20' },
  QUOTE_CONFIRMED: { label: 'Confirmed', color: 'text-rowan-blue', bg: 'bg-rowan-blue/20' },
  ESCROW_LOCKED:   { label: 'Escrow Locked', color: 'text-rowan-blue', bg: 'bg-rowan-blue/20' },
  TRADER_MATCHED:  { label: 'Trader Matched', color: 'text-rowan-yellow', bg: 'bg-rowan-yellow/20' },
  FIAT_SENT:       { label: 'Fiat Sent', color: 'text-rowan-orange', bg: 'bg-rowan-orange/20' },
  RELEASE_BLOCKED: { label: 'Release Blocked', color: 'text-rowan-red', bg: 'bg-rowan-red/20' },
  COMPLETE:        { label: 'Complete', color: 'text-rowan-green', bg: 'bg-rowan-green/20' },
  REFUNDED:        { label: 'Refunded', color: 'text-rowan-yellow', bg: 'bg-rowan-yellow/20' },
  FAILED:          { label: 'Failed', color: 'text-rowan-red', bg: 'bg-rowan-red/20' },
  OPEN:            { label: 'Open', color: 'text-rowan-orange', bg: 'bg-rowan-orange/20' },
  UNDER_REVIEW:    { label: 'Under Review', color: 'text-rowan-yellow', bg: 'bg-rowan-yellow/20' },
  RESOLVED_FOR_USER:   { label: 'Resolved (User)', color: 'text-rowan-green', bg: 'bg-rowan-green/20' },
  RESOLVED_FOR_TRADER: { label: 'Resolved (Trader)', color: 'text-rowan-green', bg: 'bg-rowan-green/20' },
  DISMISSED:       { label: 'Dismissed', color: 'text-rowan-muted', bg: 'bg-rowan-muted/20' },
}

export const NETWORKS = {
  MTN_MOMO_UG: { label: 'MTN MoMo', country: 'UG', currency: 'UGX', color: 'text-rowan-yellow' },
  AIRTEL_UG:   { label: 'Airtel Money', country: 'UG', currency: 'UGX', color: 'text-rowan-red' },
  MPESA_KE:    { label: 'M-Pesa', country: 'KE', currency: 'KES', color: 'text-rowan-green' },
  VODACOM_TZ:  { label: 'Vodacom', country: 'TZ', currency: 'TZS', color: 'text-rowan-red' },
  TIGO_TZ:     { label: 'Tigo Pesa', country: 'TZ', currency: 'TZS', color: 'text-rowan-blue' },
}

export const DISPUTE_OUTCOMES = {
  RESOLVED_FOR_USER:   { label: 'Refund User', color: 'text-rowan-red' },
  RESOLVED_FOR_TRADER: { label: 'Release to Trader', color: 'text-rowan-green' },
  DISMISSED:           { label: 'Dismiss', color: 'text-rowan-orange' },
}

export const TRADER_STATUSES = {
  ACTIVE:    { label: 'Active', color: 'text-rowan-green', bg: 'bg-rowan-green/20' },
  PAUSED:    { label: 'Pending', color: 'text-rowan-orange', bg: 'bg-rowan-orange/20' },
  SUSPENDED: { label: 'Suspended', color: 'text-rowan-red', bg: 'bg-rowan-red/20' },
  BANNED:    { label: 'Banned', color: 'text-rowan-red', bg: 'bg-rowan-red/20' },
}

export const DISPUTE_PRIORITIES = {
  high:     { label: 'High', color: 'text-rowan-red', bg: 'bg-rowan-red/20' },
  medium:   { label: 'Medium', color: 'text-rowan-orange', bg: 'bg-rowan-orange/20' },
  low:      { label: 'Low', color: 'text-rowan-muted', bg: 'bg-rowan-muted/20' },
  resolved: { label: 'Resolved', color: 'text-rowan-green', bg: 'bg-rowan-green/20' },
}

export const SYSTEM_SERVICES = [
  { key: 'api', label: 'API Server' },
  { key: 'database', label: 'PostgreSQL' },
  { key: 'redis', label: 'Redis Cache' },
  { key: 'stellarHorizon', label: 'Stellar Horizon' },
  { key: 'websocket', label: 'WebSocket' },
  { key: 'escrow', label: 'Escrow Account' },
]

export const STATE_ORDER = [
  'QUOTE_REQUESTED',
  'QUOTE_CONFIRMED',
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_SENT',
  'COMPLETE',
]

export const FILTER_STATUSES = [
  { value: '', label: 'All' },
  { value: 'QUOTE_REQUESTED', label: 'Quote Requested' },
  { value: 'ESCROW_LOCKED', label: 'Escrow Locked' },
  { value: 'TRADER_MATCHED', label: 'Trader Matched' },
  { value: 'FIAT_SENT', label: 'Fiat Sent' },
  { value: 'COMPLETE', label: 'Complete' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'RELEASE_BLOCKED', label: 'Release Blocked' },
]

export const FILTER_NETWORKS = [
  { value: '', label: 'All' },
  ...Object.entries(NETWORKS).map(([key, val]) => ({ value: key, label: val.label })),
]

export const ALERT_SEVERITIES = {
  critical: { label: 'Critical', color: 'text-rowan-red', bg: 'bg-rowan-red/15', border: 'border-rowan-red/30' },
  warning:  { label: 'Warning', color: 'text-rowan-orange', bg: 'bg-rowan-orange/15', border: 'border-rowan-orange/30' },
  info:     { label: 'Info', color: 'text-rowan-blue', bg: 'bg-rowan-blue/15', border: 'border-rowan-blue/30' },
}

export const MIN_ESCROW_XLM_RESERVE = 5
export const FLOAT_WARNING_THRESHOLD = 500_000  // UGX — flag traders with low mobile money float
export const DISPUTE_HIGH_PRIORITY_HOURS = 24
export const OVERVIEW_REFRESH_INTERVAL = 30000
export const HEALTH_REFRESH_INTERVAL = 60000
export const RATE_REFRESH_INTERVAL = 30000
export const ESCROW_REFRESH_INTERVAL = 60000
export const COPY_FEEDBACK_TIMEOUT_MS = 2000
export const API_TIMEOUT = 15000
export const SOCKET_RECONNECT_ATTEMPTS = 10
export const SOCKET_RECONNECT_DELAY = 1000
export const SOCKET_RECONNECT_DELAY_MAX = 10000

/* ── Validation limits ─────────────────────────────── */
export const RATE_MIN = 0
export const SPREAD_MAX_PERCENT = 10
export const FEE_MAX_PERCENT = 5
export const DISPUTE_NOTE_MIN_LENGTH = 20
export const SUSPEND_REASON_MIN_LENGTH = 10

/* ── Recharts hex colours (Tailwind classes don't work in SVG props) ── */
export const CHART_YELLOW = '#F0B90B'
export const CHART_GREEN = '#0ECB81'
export const CHART_RED = '#F6465D'
export const CHART_BLUE = '#1890FF'
export const CHART_ORANGE = '#F77234'
export const CHART_MUTED = '#848E9C'
export const CHART_GRID = '#2A2D35'

export const STELLAR_EXPLORER_URL = import.meta.env.VITE_STELLAR_EXPLORER_URL
