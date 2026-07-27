/**
 * Phase 2 E1 — Country registry (config-driven corridors).
 * Loads active countries + payment methods from PostgreSQL; in-memory cache refreshed on boot.
 */

import db from '../../db/index.js';
import logger from '../../utils/logger.js';

/** @type {Map<string, object>} */
let countriesByCode = new Map();

/** @type {Map<string, object[]>} */
let paymentMethodsByCountry = new Map();

function mapCountryRow(row) {
  return {
    code: row.code,
    name: row.name,
    currencyCode: row.currency_code,
    phonePrefix: row.phone_prefix,
    flagEmoji: row.flag_emoji,
    active: row.active,
    kycConfig: row.kyc_config || {},
    paymentConfig: row.payment_config || {},
    sortOrder: row.sort_order,
  };
}

function mapPaymentMethodRow(row) {
  return {
    id: row.id,
    countryCode: row.country_code,
    networkCode: row.network_code,
    label: row.label,
    provider: row.provider,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

async function loadCache() {
  const countryResult = await db.query(
    `SELECT code, name, currency_code, phone_prefix, flag_emoji, active,
            kyc_config, payment_config, sort_order
     FROM countries
     WHERE active = true
     ORDER BY sort_order ASC, code ASC`
  );

  const methodResult = await db.query(
    `SELECT id, country_code, network_code, label, provider, active, sort_order
     FROM country_payment_methods
     WHERE active = true
     ORDER BY country_code ASC, sort_order ASC, network_code ASC`
  );

  const nextCountries = new Map();
  for (const row of countryResult.rows) {
    nextCountries.set(row.code, mapCountryRow(row));
  }

  const nextMethods = new Map();
  for (const row of methodResult.rows) {
    if (!nextCountries.has(row.country_code)) continue;
    const list = nextMethods.get(row.country_code) || [];
    list.push(mapPaymentMethodRow(row));
    nextMethods.set(row.country_code, list);
  }

  countriesByCode = nextCountries;
  paymentMethodsByCountry = nextMethods;

  logger.info('[CountryRegistry] Loaded', {
    countries: countriesByCode.size,
    paymentMethods: methodResult.rows.length,
  });
}

function getActiveCountries() {
  return Array.from(countriesByCode.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

function getCountry(code) {
  if (!code) return null;
  return countriesByCode.get(String(code).trim().toUpperCase()) || null;
}

function isActiveCountry(code) {
  return Boolean(getCountry(code));
}

function getPaymentMethods(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  return paymentMethodsByCountry.get(code) || [];
}

function getNetworkCodesForCountry(countryCode) {
  return getPaymentMethods(countryCode).map((m) => m.networkCode);
}

function isValidNetworkForCountry(countryCode, networkCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  const network = String(networkCode || '').trim().toUpperCase();
  return getPaymentMethods(code).some((m) => m.networkCode === network);
}

function getCurrencyForCountry(countryCode) {
  return getCountry(countryCode)?.currencyCode || null;
}

function getCountryOptionsForClient() {
  return getActiveCountries().map((c) => ({
    code: c.code,
    name: c.name,
    fiat: c.currencyCode,
    phonePrefix: c.phonePrefix,
    flagEmoji: c.flagEmoji,
    paymentMethods: getPaymentMethods(c.code).map((m) => ({
      networkCode: m.networkCode,
      label: m.label,
      provider: m.provider,
    })),
  }));
}

export default {
  loadCache,
  getActiveCountries,
  getCountry,
  isActiveCountry,
  getPaymentMethods,
  getNetworkCodesForCountry,
  isValidNetworkForCountry,
  getCurrencyForCountry,
  getCountryOptionsForClient,
};
