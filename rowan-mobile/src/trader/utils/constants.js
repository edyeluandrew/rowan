/** Change password redirect delay (ms) */
export const CHANGE_PASSWORD_REDIRECT_MS = 2000;

/** Copy feedback timeout (ms) */
export const COPY_FEEDBACK_TIMEOUT_MS = 2000;

/** Phone number reveal timeout (ms) */
export const PHONE_REVEAL_TIMEOUT_MS = 30000;

/** Float update modal close delay (ms) */
export const FLOAT_UPDATE_CLOSE_MS = 1500;

/** Onboarding verified redirect delay (ms) */
export const ONBOARDING_VERIFIED_REDIRECT_MS = 1500;
/** Mobile money network metadata */
export const NETWORKS = {
  MTN_UG:    { label: 'MTN MoMo',  color: 'bg-rowan-gold/20 text-rowan-gold' },
  AIRTEL_UG: { label: 'Airtel UG', color: 'bg-rowan-red/20 text-rowan-red' },
  MPESA_KE:  { label: 'M-Pesa KE', color: 'bg-rowan-green/20 text-rowan-green' },
  MPESA_TZ:  { label: 'M-Pesa TZ', color: 'bg-rowan-green/20 text-rowan-green' },
};

/** Transaction states → display labels and badge styling */
export const TX_STATES = {
  TRADER_MATCHED:   { label: 'Matched',          badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  FIAT_PAYOUT_SUBMITTED: { label: 'Payment Sent', badge: 'bg-blue-500/15 text-blue-400' },
  USER_CONFIRMATION_PENDING: { label: 'Awaiting Confirmation', badge: 'bg-blue-500/15 text-blue-400' },
  DISPUTE_OPENED:   { label: 'Dispute Opened',   badge: 'bg-rowan-red/15 text-rowan-red' },
  DISPUTE_RELEASE_PENDING: { label: 'Releasing After Dispute', badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  DISPUTE_REFUND_PENDING: { label: 'Resolving Refund', badge: 'bg-rowan-yellow/15 text-rowan-yellow' },
  RELEASE_BLOCKED: { label: 'Release Blocked',  badge: 'bg-rowan-red/15 text-rowan-red' },
  COMPLETE:         { label: 'Complete',        badge: 'bg-rowan-green/15 text-rowan-green' },
  REFUNDED:         { label: 'Refunded',        badge: 'bg-rowan-muted/15 text-rowan-muted' },
  FAILED:           { label: 'Failed',          badge: 'bg-rowan-red/15 text-rowan-red' },
};

/** Axios request timeout in ms */
export const API_TIMEOUT = 30000;

/** Max socket reconnection attempts */
export const SOCKET_RECONNECT_ATTEMPTS = 5;
export const SOCKET_RECONNECT_DELAY = 1000;
export const SOCKET_RECONNECT_DELAY_MAX = 10000;

/** Stellar explorer (testnet by default) */
export const STELLAR_NETWORKS = {
  testnet: { explorerUrl: 'https://stellar.expert/explorer/testnet' },
  mainnet: { explorerUrl: 'https://stellar.expert/explorer/public' },
};

export const CURRENT_STELLAR_NETWORK =
  STELLAR_NETWORKS[import.meta.env.VITE_STELLAR_NETWORK] || STELLAR_NETWORKS.testnet;

export function stellarTxExplorerUrl(hash) {
  if (!hash) return null;
  return `${CURRENT_STELLAR_NETWORK.explorerUrl}/tx/${hash}`;
}

/** Currency flag emojis */
export const CURRENCY_FLAGS = {
  UGX: '🇺🇬',
  KES: '🇰🇪',
  TZS: '🇹🇿',
};
