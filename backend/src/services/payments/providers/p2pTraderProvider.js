/**
 * P2P trader rail — wraps existing matchingEngine / buyMatchingEngine flows.
 * This module exposes metadata for the payment router; execution stays in existing services.
 */

import { PAYMENT_PROVIDERS } from '../paymentConstants.js';

export function isAvailable() {
  return true;
}

export function describe() {
  return {
    id: PAYMENT_PROVIDERS.P2P_TRADER,
    label: 'Verified P2P trader',
    automated: false,
    description: 'Manual mobile-money payout by a verified Rowan trader with escrow protection.',
  };
}

export default {
  isAvailable,
  describe,
};
