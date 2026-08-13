import { COUNTRY_CODES, NETWORKS } from './constants'

/** Launch surface: Uganda only. */
export const SUPPORTED_COUNTRIES = ['UG']

/** Markets shown as disabled “Coming soon” in pickers (not selectable). */
export const COMING_SOON_COUNTRIES = ['KE', 'TZ']

export const COUNTRY_FIAT = {
  UG: 'UGX',
  KE: 'KES',
  TZ: 'TZS',
}

/** Fiat code → country code (first match). */
export function fiatToCountry(fiat) {
  const entry = Object.entries(COUNTRY_FIAT).find(([, code]) => code === fiat)
  return entry?.[0] || 'UG'
}

export function isSupportedCountry(code) {
  return SUPPORTED_COUNTRIES.includes(code)
}

export function getFiatForCountry(country) {
  return COUNTRY_FIAT[country] || 'UGX'
}

/** Pick first non-empty fiat code, else UGX. */
export function resolveFiatCurrency(...candidates) {
  const found = candidates.find((c) => c && String(c).trim())
  if (found) return found
  return 'UGX'
}

/** Default utility amount bounds when API config is missing (local currency). */
export const COUNTRY_UTILITY_LIMITS = {
  UG: { min: 1000, max: 500000 },
  KE: { min: 100, max: 50000 },
  TZ: { min: 1000, max: 500000 },
  RW: { min: 500, max: 500000 },
  NG: { min: 500, max: 500000 },
  GH: { min: 10, max: 5000 },
}

export function getUtilityLimitsForCountry(country) {
  return COUNTRY_UTILITY_LIMITS[country] || COUNTRY_UTILITY_LIMITS.UG
}

export function getDialCodeForCountry(country) {
  return COUNTRY_CODES[country]?.code || '+256'
}

/** Mobile money networks for a country (e.g. MTN_UG, MPESA_KE). */
export function getNetworksForCountry(country) {
  return Object.fromEntries(
    Object.entries(NETWORKS).filter(([, network]) => network.country === country)
  )
}

export function getCountryOptions() {
  return SUPPORTED_COUNTRIES.map((code) => ({
    code,
    ...COUNTRY_CODES[code],
    fiat: COUNTRY_FIAT[code],
  }))
}
