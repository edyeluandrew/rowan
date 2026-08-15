/** Registered payment rail providers (C2). */
export const PAYMENT_PROVIDERS = {
  MARZ_PAY: 'marz_pay',
  YELLOW_PAY: 'yellow_pay',
  P2P_TRADER: 'p2p_trader',
};

/** Cash flow direction relative to the user's USDC wallet. */
export const PAYMENT_SIDES = {
  OFFRAMP: 'offramp',
  ONRAMP: 'onramp',
};

/** Uganda-only launch: P2P first. Aggregators rejoin via countries.payment_config. */
export const DEFAULT_OFFRAMP_CHAIN = [
  PAYMENT_PROVIDERS.P2P_TRADER,
];

export const DEFAULT_ONRAMP_CHAIN = [
  PAYMENT_PROVIDERS.P2P_TRADER,
];
