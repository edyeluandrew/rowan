/** Supported display / rate fiat currencies */
export const FIAT_CURRENCIES = ['UGX', 'KES', 'TZS']

export const FIAT_OPTIONS = [
  { code: 'UGX', label: 'Uganda', flag: '🇺🇬' },
  { code: 'KES', label: 'Kenya', flag: '🇰🇪' },
  { code: 'TZS', label: 'Tanzania', flag: '🇹🇿' },
]

export function xlmToFiat(xlmBalance, xlmRate) {
  const xlm = parseFloat(xlmBalance)
  const rate = parseFloat(xlmRate)
  if (!Number.isFinite(xlm) || !Number.isFinite(rate) || rate <= 0) return null
  return xlm * rate
}

export function formatFiatAmount(amount, currency, options = {}) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return `— ${currency}`
  const decimals = currency === 'KES' ? 2 : 0
  return `${currency} ${value.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: options.compact ? 0 : decimals,
    ...options,
  })}`
}
