/** States that block starting a new cashout / P2P order for the same user. */
export const USER_ACTIVE_ORDER_STATES = [
  'QUOTE_REQUESTED',
  'QUOTE_CONFIRMED',
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_PAYOUT_SUBMITTED',
  'USER_CONFIRMATION_PENDING',
  'DISPUTE_OPENED',
];

export default USER_ACTIVE_ORDER_STATES;
