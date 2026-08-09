/**
 * Map API / transport errors to short user-facing copy.
 * Prefer backend `code` when present; otherwise match known message snippets.
 */

const CODE_MESSAGES = {
  // Shared / order lock
  active_order_exists: 'You already have an open trade. Finish or cancel it before starting another.',
  ACTIVE_ORDER_EXISTS: 'You already have an open trade. Finish or cancel it before starting another.',

  // Amounts & corridors
  AMOUNT_MODE_REQUIRED: 'Enter either a USDC or mobile-money amount — not both.',
  AMOUNT_ABOVE_NETWORK_MAX: 'That amount is above the limit for this network. Try a smaller amount.',
  AMOUNT_BELOW_NETWORK_MIN: 'That amount is below the minimum for this network. Try a larger amount.',
  COUNTRY_NOT_AVAILABLE: 'This product is not available in your country yet.',
  NETWORK_NOT_AVAILABLE: 'That mobile-money network is not available here. Pick another.',
  NO_TRADERS_FOR_NETWORK: 'No traders are online for this network right now. Try again later or another network.',
  NO_BUY_TRADERS: 'No one is selling USDC on this network right now. Try again later.',

  // Compliance
  SANCTIONS_BLOCK: 'This transfer could not be verified and was blocked. Contact support if you think this is wrong.',
  SCREENING_UNAVAILABLE: 'Safety checks are temporarily unavailable. Please try again in a few minutes.',

  // Quotes / rates
  RATE_UNAVAILABLE: 'Live rates are unavailable. Pull to refresh and try again.',
  LIQUIDITY_UNAVAILABLE: 'Liquidity is tight right now. Please try a smaller amount or try later.',

  // Utility payments
  PAYMENT_TX_REQUIRED: 'Send the USDC payment first, then complete the purchase.',
  PAYMENT_TX_NOT_FOUND: 'We could not find that payment on Stellar yet. Wait a few seconds and retry.',
  PAYMENT_TX_REUSED: 'That payment was already used. Start a new quote if you need another top-up.',
  PAYMENT_MEMO_MISMATCH: 'Payment memo does not match this quote. Send again with the exact memo shown.',
  PAYMENT_WRONG_SENDER: 'Payment must come from your Rowan wallet address.',
  PAYMENT_AMOUNT_MISMATCH: 'USDC amount does not match the quote. Send the exact amount shown.',
  PAYMENT_WRONG_DESTINATION: 'Payment must go to the Rowan utility treasury address shown.',

  // Generic HTTP-ish
  NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
  TIMEOUT: 'The request took too long. Check your connection and try again.',
}

const MESSAGE_SNIPPETS = [
  [/quote expired/i, 'This quote expired. Get a new quote and try again.'],
  [/active.?order/i, 'You already have an open trade. Finish or cancel it before starting another.'],
  [/insufficient/i, 'Not enough USDC for this amount. Top up or lower the amount.'],
  [/trustline/i, 'Enable the USDC trustline on your wallet first, then try again.'],
  [/memo/i, 'Payment memo is wrong or missing. Use the exact memo from the quote screen.'],
  [/no traders/i, 'No traders available right now. Try again later or another network.'],
  [/cancelled by buyer/i, 'This order was cancelled.'],
  [/could not cancel|cancellation is no longer/i, 'This order can no longer be cancelled. Wait for the window to end or open a dispute if needed.'],
  [/payment window is closing/i, 'The payment window is almost closed — wait it out or raise a dispute if something is wrong.'],
  [/wallet balance is too low|reloadly/i, 'Top-up service is temporarily unavailable. Please try again in a few minutes.'],
  [/rate/i, 'Rate or pricing failed. Refresh and try again.'],
  [/unauthorized|401|session/i, 'Session expired. Sign in again and retry.'],
  [/network error|failed to fetch|timeout|econnaborted/i, 'Could not reach the server. Check your connection and try again.'],
]

/**
 * @param {unknown} err - axios error or Error
 * @param {string} [fallback='Something went wrong. Please try again.']
 */
export function mapApiError(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback

  const data = err.response?.data
  const code = data?.code || err.code
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code]
  }

  // Backend sometimes uses error field as a code
  if (typeof data?.error === 'string' && CODE_MESSAGES[data.error]) {
    return CODE_MESSAGES[data.error]
  }

  const status = err.response?.status
  if (status === 410) {
    return 'This quote or window expired. Start again with a fresh quote.'
  }
  if (status === 409) {
    return data?.error && !/^[A-Z0-9_]+$/.test(data.error)
      ? data.error
      : 'This action is no longer available for this order.'
  }
  if (status === 503) {
    return data?.error && typeof data.error === 'string' && data.error.length < 160
      ? data.error
      : 'Service is temporarily unavailable. Please try again shortly.'
  }
  if (status === 401) {
    return 'Session expired. Sign in again and retry.'
  }
  if (status === 429) {
    return 'Too many attempts. Wait a moment and try again.'
  }

  const raw =
    (typeof data?.message === 'string' && data.message)
    || (typeof data?.error === 'string' && data.error)
    || (typeof err.message === 'string' && err.message)
    || ''

  if (raw) {
    for (const [re, friendly] of MESSAGE_SNIPPETS) {
      if (re.test(raw)) return friendly
    }
    // Drop technical jargon / stackish strings
    if (raw.length <= 160 && !/at\s+\w+\s+\(/.test(raw) && !raw.includes('ECONN')) {
      // Map common backend error codes used as free text
      if (CODE_MESSAGES[raw]) return CODE_MESSAGES[raw]
      return raw
    }
  }

  if (!err.response && (err.request || err.message === 'Network Error')) {
    return CODE_MESSAGES.NETWORK_ERROR
  }

  return fallback
}

/**
 * Compact helper when only message string is available (no Error object).
 */
export function mapErrorMessage(message, fallback = 'Something went wrong. Please try again.') {
  if (!message || typeof message !== 'string') return fallback
  return mapApiError({ message, response: { data: { error: message } } }, fallback)
}
