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
  QUOTE_REQUESTED:  { label: 'Getting your rate...',  icon: 'CircleDashed'   },
  QUOTE_CONFIRMED:  { label: 'Rate confirmed',  icon: 'CircleDot'      },
  ESCROW_LOCKED:    { label: 'Funds secured',   icon: 'Lock'           },
  TRADER_MATCHED:   { label: 'Trader found',  icon: 'UserCheck'      },
  FIAT_PAYOUT_SUBMITTED: { label: 'Payment sent to you', icon: 'Banknote' },
  USER_CONFIRMATION_PENDING: { label: 'Confirm your payment', icon: 'ShieldCheck' },
  DISPUTE_OPENED:   { label: 'Under review',   icon: 'ShieldAlert'    },
  DISPUTE_RELEASE_PENDING: { label: 'Under review', icon: 'ShieldAlert' },
  DISPUTE_REFUND_PENDING: { label: 'Under review', icon: 'ShieldAlert' },
  RELEASE_BLOCKED:  { label: 'Needs attention',  icon: 'CircleX'        },
  COMPLETE:         { label: 'Done!',         icon: 'CircleCheckBig' },
  REFUNDED:         { label: 'Refunded',         icon: 'RotateCcw'      },
  FAILED:           { label: 'Transaction failed',           icon: 'CircleX'        },
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
  'FIAT_PAYOUT_SUBMITTED',
  'USER_CONFIRMATION_PENDING',
  'COMPLETE',
  'DISPUTE_OPENED',
  'DISPUTE_RELEASE_PENDING',
  'DISPUTE_REFUND_PENDING',
]

export const STATE_SUBTITLES = {
  QUOTE_CONFIRMED: 'Waiting for your USDC payment',
  ESCROW_LOCKED:   'Finding a trader for your cash out',
  TRADER_MATCHED:  'Mobile money payout pending',
  FIAT_PAYOUT_SUBMITTED: 'Check your phone — confirm when MoMo arrives',
  USER_CONFIRMATION_PENDING: 'Confirming your receipt',
  DISPUTE_OPENED: 'Dispute opened — under review',
  DISPUTE_RELEASE_PENDING: 'Resolving dispute',
  DISPUTE_REFUND_PENDING: 'Processing refund',
  RELEASE_BLOCKED: 'Needs attention — contact support',
  COMPLETE:        'Done — check your mobile money balance',
  REFUNDED:        'Refunded to your wallet',
  FAILED:          'Could not complete — tap for details',
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

/** Testnet pilot: auto-grant this much USDC after wallet setup (via XLM→USDC swap). */
export const TESTNET_AUTO_USDC_AMOUNT = 100
/** Skip auto-fund when wallet already holds at least this much USDC. */
export const TESTNET_MIN_USDC_FOR_SKIP = 1

/** Testnet / mainnet USDC issuers — must match backend config */
export const USDC_ISSUERS = {
  testnet:
    import.meta.env.VITE_USDC_ISSUER_TESTNET ||
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  mainnet:
    import.meta.env.VITE_USDC_ISSUER_MAINNET ||
    'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
}
