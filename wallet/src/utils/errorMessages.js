/**
 * [PHASE 4] User-friendly error message translator
 * 
 * Converts technical backend error messages into clear, actionable guidance for users.
 */

const ERROR_MESSAGE_MAP = {
  // Liquidity/path errors
  'No valid path found': 'Liquidity temporarily unavailable. Please try again in a moment.',
  'No liquidity': 'Unable to find a good exchange rate right now. Please try again shortly.',
  'Liquidity unavailable': 'Not enough liquidity available. Please reduce the amount or try again later.',
  
  // Quote expiry
  'Quote expired': 'This quote has expired. Please request a new quote to proceed.',
  'quote is no longer valid': 'This quote has expired. Please request a new quote.',
  
  // Amount/validation errors
  'Minimum cash-out amount': 'Amount is below the minimum. Please increase to at least 1 XLM.',
  'Invalid amount': 'Please enter a valid amount greater than 0.',
  'exceeds': 'This amount exceeds your daily limit. Please try a smaller amount.',
  
  // Authentication/limits
  'Account disabled': 'Your account is currently disabled. Please contact support.',
  'User not found': 'We could not find your account. Please log in again.',
  'Too many open quotes': 'You have too many pending quotes. Please wait for one to expire.',
  
  // Fraud/KYC
  'KYC level': 'Your account verification level limits this transaction. Please verify your account.',
  'daily limit': 'You\'ve reached your daily limit. Please try again tomorrow or verify your account.',
  'per-transaction limit': 'This amount exceeds your per-transaction limit. Please reduce the amount.',
  
  // Network/API errors
  'Network error': 'Connection error. Please check your internet and try again.',
  'timeout': 'Request timed out. Please check your connection and try again.',
  'failed to fetch': 'Could not connect to the server. Please try again.',
  
  // Default fallback
  'default': 'Something went wrong. Please try again or contact support if the problem persists.'
}

/**
 * Transform a backend error message into user-friendly guidance
 * @param {string} errorMsg - Raw error message from backend or API
 * @returns {string} - User-friendly error message with guidance
 */
export function getUserFriendlyError(errorMsg) {
  if (!errorMsg) {
    return ERROR_MESSAGE_MAP.default
  }

  const msg = errorMsg.toLowerCase()

  // Check for exact or partial matches in our map
  for (const [key, friendlyMsg] of Object.entries(ERROR_MESSAGE_MAP)) {
    if (key !== 'default' && msg.includes(key.toLowerCase())) {
      return friendlyMsg
    }
  }

  // If the error message is short and seems user-appropriate, use it directly
  if (errorMsg.length < 100 && !errorMsg.includes('_') && !errorMsg.includes('stack')) {
    return errorMsg
  }

  // Fallback to default
  return ERROR_MESSAGE_MAP.default
}

/**
 * Get contextual action text based on error type
 * @param {string} errorMsg - Raw error message
 * @returns {object} - { action: string, actionText: string }
 */
export function getErrorAction(errorMsg) {
  const msg = (errorMsg || '').toLowerCase()

  if (msg.includes('expired') || msg.includes('no longer valid')) {
    return { action: 'getNewQuote', actionText: 'Get New Quote' }
  }

  if (msg.includes('liquidity')) {
    return { action: 'retry', actionText: 'Try Again' }
  }

  if (msg.includes('amount') || msg.includes('minimum')) {
    return { action: 'adjustAmount', actionText: 'Adjust Amount' }
  }

  if (msg.includes('account')) {
    return { action: 'contactSupport', actionText: 'Contact Support' }
  }

  return { action: 'retry', actionText: 'Try Again' }
}
