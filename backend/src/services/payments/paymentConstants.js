/** Registered payment rail providers (C2). */
export const PAYMENT_PROVIDERS = {
  MARZ_PAY: 'marz_pay',
  P2P_TRADER: 'p2p_trader',
};

/** Cash flow direction relative to the user's USDC wallet. */
export const PAYMENT_SIDES = {
  OFFRAMP: 'offramp',
  ONRAMP: 'onramp',
};

/** Uganda launch: P2P for USDC buy/sell. MarzPay is bills/airtime/data only. */
export const DEFAULT_OFFRAMP_CHAIN = [
  PAYMENT_PROVIDERS.P2P_TRADER,
];

export const DEFAULT_ONRAMP_CHAIN = [
  PAYMENT_PROVIDERS.P2P_TRADER,
];
