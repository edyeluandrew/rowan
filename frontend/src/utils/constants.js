/** Change password redirect delay (ms) */
export const CHANGE_PASSWORD_REDIRECT_MS = 2000;

/** Copy feedback timeout (ms) */
export const COPY_FEEDBACK_TIMEOUT_MS = 2000;

/** Float update modal close delay (ms) */
export const FLOAT_UPDATE_CLOSE_MS = 1500;

/** Onboarding verified redirect delay (ms) */
export const ONBOARDING_VERIFIED_REDIRECT_MS = 1500;
/** Mobile money network metadata */
export const NETWORKS = {
  MTN_UG:    { label: 'MTN MoMo',  color: 'bg-rowan-yellow/20 text-rowan-yellow' },
  AIRTEL_UG: { label: 'Airtel UG', color: 'bg-rowan-red/20 text-rowan-red' },
  MPESA_KE:  { label: 'M-Pesa KE', color: 'bg-rowan-green/20 text-rowan-green' },
  MPESA_TZ:  { label: 'M-Pesa TZ', color: 'bg-rowan-green/20 text-rowan-green' },
};

/** Transaction states → display labels and badge styling */
export const TX_STATES = {
  PENDING_ESCROW:   { label: 'Pending Escrow',  badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  ESCROW_FUNDED:    { label: 'Escrow Funded',    badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  TRADER_MATCHED:   { label: 'Matched',          badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  FIAT_SENT:        { label: 'Fiat Sent',        badge: 'bg-blue-500/15 text-blue-400' },
  COMPLETE:         { label: 'Complete',          badge: 'bg-rowan-green/15 text-rowan-green' },
  REFUNDED:         { label: 'Refunded',          badge: 'bg-rowan-muted/15 text-rowan-muted' },
  DISPUTED:         { label: 'Disputed',          badge: 'bg-rowan-red/15 text-rowan-red' },
  FAILED:           { label: 'Failed',            badge: 'bg-rowan-red/15 text-rowan-red' },
};

/** Axios request timeout in ms */
export const API_TIMEOUT = 30000;

/** Max socket reconnection attempts */
export const SOCKET_RECONNECT_ATTEMPTS = 5;

/** Socket reconnection delay (ms) */
export const SOCKET_RECONNECT_DELAY = 1000;

/** Socket max reconnection delay (ms) */
export const SOCKET_RECONNECT_DELAY_MAX = 5000;

/** Currency flag emojis */
export const CURRENCY_FLAGS = {
  UGX: '🇺🇬',
  KES: '🇰🇪',
  TZS: '🇹🇿',
};
