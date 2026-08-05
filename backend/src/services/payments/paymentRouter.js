/**
 * Phase 2 C9 — Country-aware payment provider routing.
 * Default: P2P trader (Uganda launch). Yellow Pay optional via countries.payment_config.
 */

import countryService from '../countries/countryService.js';
import yellowPayProvider from './providers/yellowPayProvider.js';
import p2pTraderProvider from './providers/p2pTraderProvider.js';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_SIDES,
  DEFAULT_OFFRAMP_CHAIN,
  DEFAULT_ONRAMP_CHAIN,
} from './paymentConstants.js';

export function networkToCountryCode(network) {
  const networkCode = String(network || '').trim().toUpperCase();
  for (const country of countryService.getActiveCountries()) {
    if (countryService.isValidNetworkForCountry(country.code, networkCode)) {
      return country.code;
    }
  }
  if (networkCode.includes('MPESA')) return 'KE';
  if (networkCode.endsWith('_RW')) return 'RW';
  if (networkCode.endsWith('_TZ')) return 'TZ';
  if (networkCode.endsWith('_UG')) return 'UG';
  if (networkCode.endsWith('_NG')) return 'NG';
  if (networkCode.endsWith('_GH')) return 'GH';
  return null;
}

function normalizeSide(side) {
  const s = String(side || '').toLowerCase();
  return s === PAYMENT_SIDES.ONRAMP ? PAYMENT_SIDES.ONRAMP : PAYMENT_SIDES.OFFRAMP;
}

/**
 * Resolve ordered provider chain from country registry (E1).
 * Supports legacy keys: default_offramp_provider + fallback_provider.
 * Unknown ids (e.g. legacy kotani_pay in old configs) are filtered out.
 */
export function getProviderChain(countryCode, side) {
  const code = String(countryCode || '').trim().toUpperCase();
  const country = countryService.getCountry(code);
  const cfg = country?.paymentConfig || {};
  const normalizedSide = normalizeSide(side);
  const listKey = normalizedSide === PAYMENT_SIDES.ONRAMP ? 'onramp' : 'offramp';

  const known = new Set(Object.values(PAYMENT_PROVIDERS));

  if (Array.isArray(cfg[listKey]) && cfg[listKey].length) {
    const chain = cfg[listKey].map(String).filter((id) => known.has(id));
    if (chain.length) return chain;
  }

  if (normalizedSide === PAYMENT_SIDES.OFFRAMP) {
    const primary = cfg.default_offramp_provider || PAYMENT_PROVIDERS.P2P_TRADER;
    const fallback = cfg.fallback_provider || PAYMENT_PROVIDERS.P2P_TRADER;
    return [primary, fallback]
      .filter((id) => known.has(String(id)))
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }

  return normalizedSide === PAYMENT_SIDES.ONRAMP ? DEFAULT_ONRAMP_CHAIN : DEFAULT_OFFRAMP_CHAIN;
}

function evaluateProvider(providerId, countryCode, side) {
  if (providerId === PAYMENT_PROVIDERS.YELLOW_PAY) {
    if (yellowPayProvider.isAvailable(countryCode, side)) {
      return {
        id: PAYMENT_PROVIDERS.YELLOW_PAY,
        label: 'Yellow Pay',
        automated: true,
        mock: yellowPayProvider.yellowPayIsMock(),
      };
    }
    return {
      id: PAYMENT_PROVIDERS.YELLOW_PAY,
      unavailable: true,
      reason: yellowPayProvider.unavailableReason(countryCode, side),
    };
  }

  if (providerId === PAYMENT_PROVIDERS.P2P_TRADER) {
    return p2pTraderProvider.describe();
  }

  return { id: providerId, unavailable: true, reason: 'Unknown provider' };
}

/**
 * Build execution plan: primary provider + fallbacks.
 */
export function resolvePaymentPlan({ countryCode, side, preferProvider }) {
  const code = String(countryCode || '').trim().toUpperCase();
  const normalizedSide = normalizeSide(side);
  const chain = getProviderChain(code, normalizedSide);

  let ordered = chain;
  if (preferProvider && chain.includes(preferProvider)) {
    ordered = [preferProvider, ...chain.filter((p) => p !== preferProvider)];
  }

  const evaluated = ordered.map((id) => evaluateProvider(id, code, normalizedSide));
  const available = evaluated.filter((p) => !p.unavailable);
  const unavailable = evaluated.filter((p) => p.unavailable);

  return {
    countryCode: code,
    side: normalizedSide,
    chain: ordered,
    primary: available[0] || null,
    fallbackChain: available.slice(1),
    unavailable,
    hasAutomatedRail: available.some((p) => p.automated),
  };
}

export function getAllCorridorSummaries() {
  return countryService.getActiveCountries().map((c) => ({
    code: c.code,
    name: c.name,
    offramp: resolvePaymentPlan({ countryCode: c.code, side: PAYMENT_SIDES.OFFRAMP }),
    onramp: resolvePaymentPlan({ countryCode: c.code, side: PAYMENT_SIDES.ONRAMP }),
  }));
}

export default {
  networkToCountryCode,
  getProviderChain,
  resolvePaymentPlan,
  getAllCorridorSummaries,
};
