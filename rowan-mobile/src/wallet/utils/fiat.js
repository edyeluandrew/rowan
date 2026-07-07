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

export function usdcToFiat(usdcBalance, usdcToFiatRate) {
  const usdc = parseFloat(usdcBalance)
  const rate = parseFloat(usdcToFiatRate)
  if (!Number.isFinite(usdc) || !Number.isFinite(rate) || rate <= 0) return null
  return usdc * rate
}

/** Conservative max net fiat cash-out from XLM balance (spread + fee buffer). */
export function estimateMaxNetFiat(xlmBalance, xlmRate, feePercent = 1, spreadPercent = 1.25) {
  const gross = xlmToFiat(xlmBalance, xlmRate)
  if (gross == null) return null
  return gross * (1 - spreadPercent / 100) * (1 - feePercent / 100)
}

/** Conservative max net fiat cash-out from USDC balance. */
export function estimateMaxNetFiatFromUsdc(usdcBalance, usdcToFiatRate, feePercent = 1, spreadPercent = 1.25) {
  const gross = usdcToFiat(usdcBalance, usdcToFiatRate)
  if (gross == null) return null
  return gross * (1 - spreadPercent / 100) * (1 - feePercent / 100)
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
