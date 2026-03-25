/**
 * Application-wide constants.
 */

export const NETWORKS = {
  MTN_UG: {
    label: 'MTN MoMo',
    currency: 'UGX',
    country: 'UG',
    color: 'text-rowan-yellow',
    bg: 'bg-rowan-yellow/20',
  },
  AIRTEL_UG: {
    label: 'Airtel',
    currency: 'UGX',
    country: 'UG',
    color: 'text-rowan-red',
    bg: 'bg-rowan-red/20',
  },
  MPESA_KE: {
    label: 'M-Pesa',
    currency: 'KES',
    country: 'KE',
    color: 'text-rowan-green',
    bg: 'bg-rowan-green/20',
  },
  MTN_TZ: {
    label: 'MTN',
    currency: 'TZS',
    country: 'TZ',
    color: 'text-rowan-muted',
    bg: 'bg-rowan-surface',
  },
  AIRTEL_TZ: {
    label: 'Airtel',
    currency: 'TZS',
    country: 'TZ',
    color: 'text-blue-400',
    bg: 'bg-blue-400/20',
  },
}

export const TX_STATES = {
  QUOTE_REQUESTED:  { label: 'Quote Requested',  icon: 'CircleDashed'   },
  QUOTE_CONFIRMED:  { label: 'Quote Confirmed',  icon: 'CircleDot'      },
  ESCROW_LOCKED:    { label: 'XLM Received',     icon: 'Lock'           },
  TRADER_MATCHED:   { label: 'Trader Assigned',  icon: 'UserCheck'      },
  FIAT_SENT:        { label: 'Money Sent',        icon: 'Banknote'       },
  COMPLETE:         { label: 'Complete',          icon: 'CircleCheckBig' },
  REFUNDED:         { label: 'Refunded',          icon: 'RotateCcw'      },
  FAILED:           { label: 'Failed',            icon: 'CircleX'        },
  DISPUTED:         { label: 'Disputed',          icon: 'ShieldAlert'    },
}

export const KYC_LEVELS = {
  NONE:     { label: 'Unverified', color: 'text-rowan-muted'  },
  BASIC:    { label: 'Basic',      color: 'text-rowan-yellow' },
  VERIFIED: { label: 'Verified',   color: 'text-rowan-green'  },
}

export const COUNTRY_CODES = {
  UG: { code: '+256', label: 'UG +256', flag: '🇺🇬', name: 'Uganda' },
  KE: { code: '+254', label: 'KE +254', flag: '🇰🇪', name: 'Kenya' },
  TZ: { code: '+255', label: 'TZ +255', flag: '🇹🇿', name: 'Tanzania' },
}

export const MIN_XLM_AMOUNT = 1
export const QUOTE_REFRESH_INTERVAL = 30000
export const SOCKET_RECONNECT_ATTEMPTS = 5
export const SOCKET_RECONNECT_DELAY = 1000
export const SOCKET_RECONNECT_DELAY_MAX = 10000
export const API_TIMEOUT = 30000
export const OTP_COOLDOWN_SECONDS = 60
export const ESTIMATED_DELIVERY = 'Under 5 minutes'
export const COPY_FEEDBACK_TIMEOUT_MS = 2000
export const WALLET_GEN_DELAY_MS = 1500
export const CLIPBOARD_AUTO_CLEAR_MS = 30000
export const STELLAR_TX_TIMEOUT_SECONDS = 180

/* ── Hex colours for contexts where Tailwind classes are unavailable ── */
export const ROWAN_BG_HEX = '#0B0E11'
export const ROWAN_YELLOW_HEX = '#F0B90B'
export const QR_FG_HEX = ROWAN_BG_HEX
export const QR_BG_HEX = '#FFFFFF'

export const STATE_ORDER = [
  'QUOTE_CONFIRMED',
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_SENT',
  'COMPLETE',
]

export const STATE_SUBTITLES = {
  QUOTE_CONFIRMED: 'Quote confirmed, waiting for XLM',
  ESCROW_LOCKED:   'XLM received — swapping to USDC',
  TRADER_MATCHED:  'OTC trader assigned — sending your money',
  FIAT_SENT:       'Mobile money sent to your number',
  COMPLETE:        'Done — check your mobile money balance',
}

export const ALERT_DIRECTIONS = {
  ABOVE: { label: 'Goes above', symbol: '>' },
  BELOW: { label: 'Drops below', symbol: '<' },
}

export const ALERT_CURRENCIES = ['XLM/UGX', 'XLM/KES', 'XLM/TZS', 'USDC/UGX']

export const MAX_ACTIVE_ALERTS = 10

/* ── Stellar Network Config ─────────────────────────── */
export const STELLAR_NETWORKS = {
  testnet: {
    passphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    friendbotUrl: 'https://friendbot.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    isTest: true,
  },
  mainnet: {
    passphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    friendbotUrl: null,
    explorerUrl: 'https://stellar.expert/explorer/public',
    isTest: false,
  },
}

export const CURRENT_NETWORK =
  STELLAR_NETWORKS[import.meta.env.VITE_STELLAR_NETWORK] ||
  STELLAR_NETWORKS.testnet
