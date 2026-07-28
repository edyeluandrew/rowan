import { NETWORKS } from './constants'

/** Must stay in sync with backend NETWORK_RELOADLY_ALIASES. */
export const NETWORK_RELOADLY_ALIASES = {
  MPESA_KE: ['safaricom', 'mpesa'],
  MPESA: ['safaricom', 'mpesa'],
  MTN_UG: ['mtn'],
  AIRTEL_UG: ['airtel'],
  MTN_TZ: ['mtn', 'tigo'],
  AIRTEL_TZ: ['airtel', 'tigo'],
  TIGO_TZ: ['tigo'],
  MTN_RW: ['mtn'],
  AIRTEL_RW: ['airtel'],
  MTN_NG: ['mtn'],
  AIRTEL_NG: ['airtel'],
  MTN_GH: ['mtn'],
  AIRTELTIGO_GH: ['airtel', 'tigo'],
  VODAFONE_GH: ['vodafone'],
}

export function reloadlySearchTokens(networkCode) {
  const code = String(networkCode || '').toUpperCase()
  if (NETWORK_RELOADLY_ALIASES[code]) return NETWORK_RELOADLY_ALIASES[code]
  const label = NETWORKS[code]?.label || code
  const token = label.split(/[\s_]/)[0].toLowerCase()
  return token ? [token] : []
}

export function operatorMatchesReloadlyNetwork(operator, networkCode) {
  const tokens = reloadlySearchTokens(networkCode)
  if (!tokens.length) return true
  const name = String(operator?.name || '').toLowerCase()
  return tokens.some((t) => name.includes(t))
}

export function limitsFromReloadlyOperators(operators, networkCode, currency) {
  const list = Array.isArray(operators) ? operators : []
  const op = list.find((o) => operatorMatchesReloadlyNetwork(o, networkCode) && !o.data && !o.bundle)
    || list.find((o) => operatorMatchesReloadlyNetwork(o, networkCode))
    || list.find((o) => !o.data && !o.bundle)
    || list[0]
  if (!op) return null

  const denominationType = String(op.denominationType || 'RANGE').toUpperCase()
  const fiatCurrency = op.destinationCurrencyCode || op.fx?.currencyCode || currency

  if (denominationType === 'FIXED') {
    const amounts = (op.localFixedAmounts?.length ? op.localFixedAmounts : op.fixedAmounts || [])
      .map(Number)
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
    if (!amounts.length) return null
    return {
      denominationType: 'FIXED',
      fiatCurrency,
      minFiatAmount: amounts[0],
      maxFiatAmount: amounts[amounts.length - 1],
      allowedAmounts: amounts,
      suggestedAmounts: op.suggestedAmounts || [],
      operatorName: op.name,
      source: 'operators-fallback',
    }
  }

  let minFiatAmount = null
  let maxFiatAmount = null
  if (op.supportsLocalAmounts !== false && op.localMinAmount != null && op.localMaxAmount != null) {
    minFiatAmount = Number(op.localMinAmount)
    maxFiatAmount = Number(op.localMaxAmount)
  } else if (op.minAmount != null && op.maxAmount != null && op.fx?.rate) {
    minFiatAmount = Number(op.minAmount) * Number(op.fx.rate)
    maxFiatAmount = Number(op.maxAmount) * Number(op.fx.rate)
  } else {
    minFiatAmount = op.minAmount != null ? Number(op.minAmount) : null
    maxFiatAmount = op.maxAmount != null ? Number(op.maxAmount) : null
  }

  return {
    denominationType: 'RANGE',
    fiatCurrency,
    minFiatAmount,
    maxFiatAmount,
    allowedAmounts: [],
    suggestedAmounts: op.suggestedAmounts || [],
    operatorName: op.name,
    source: 'operators-fallback',
  }
}

export function dataOperatorFromList(operators, networkCode) {
  const list = Array.isArray(operators) ? operators : []
  return list.find((o) => (o.data || o.bundle) && operatorMatchesReloadlyNetwork(o, networkCode))
    || list.find((o) => o.data || o.bundle)
}
