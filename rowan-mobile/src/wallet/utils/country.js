import { COUNTRY_CODES, NETWORKS } from './constants'

export const SUPPORTED_COUNTRIES = ['UG', 'KE', 'TZ']

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
