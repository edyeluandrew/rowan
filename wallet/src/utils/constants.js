/**
 * Application-wide constants.
 */

export const NETWORKS = {
  MTN_MOMO_UG: {
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
  VODACOM_TZ: {
    label: 'Vodacom',
    currency: 'TZS',
    country: 'TZ',
    color: 'text-rowan-muted',
    bg: 'bg-rowan-surface',
  },
  TIGO_TZ: {
    label: 'Tigo',
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
  UG: { code: '+256', label: 'UG +256' },
  KE: { code: '+254', label: 'KE +254' },
  TZ: { code: '+255', label: 'TZ +255' },
}

export const MIN_XLM_AMOUNT = 1
export const QUOTE_REFRESH_INTERVAL = 30000
export const SOCKET_RECONNECT_ATTEMPTS = 5
export const API_TIMEOUT = 30000
export const OTP_COOLDOWN_SECONDS = 60

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
