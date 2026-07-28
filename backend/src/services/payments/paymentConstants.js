/** Registered payment rail providers (C2). */
export const PAYMENT_PROVIDERS = {
  KOTANI_PAY: 'kotani_pay',
  YELLOW_PAY: 'yellow_pay',
  P2P_TRADER: 'p2p_trader',
};

/** Cash flow direction relative to the user's USDC wallet. */
export const PAYMENT_SIDES = {
  OFFRAMP: 'offramp',
  ONRAMP: 'onramp',
};

export const DEFAULT_OFFRAMP_CHAIN = [
  PAYMENT_PROVIDERS.KOTANI_PAY,
  PAYMENT_PROVIDERS.P2P_TRADER,
];

export const DEFAULT_ONRAMP_CHAIN = [
  PAYMENT_PROVIDERS.KOTANI_PAY,
  PAYMENT_PROVIDERS.P2P_TRADER,
];
