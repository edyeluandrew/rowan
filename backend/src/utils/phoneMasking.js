/**
 * Phone number masking utility
 * Hides sensitive phone number data while keeping first/last digits visible
 * 
 * Example: +256764331334 → +256 *** *** 334
 */

/**
 * Mask a phone number for trader visibility before acceptance
 * Shows only country code and last 3 digits
 * 
 * @param {string} phone - Full phone number (e.g., "+256764331334")
 * @returns {string} Masked phone (e.g., "+256 *** *** 334")
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return 'Unknown';
  
  // Extract country code (everything up to first digit or +)
  const countryMatch = phone.match(/^\+?\d{1,3}/);
  const countryCode = countryMatch ? countryMatch[0] : '';
  
  // Get last 3 digits
  const digits = phone.replace(/\D/g, '');
  const lastThree = digits.slice(-3);
  
  // Format: +256 *** *** 334
  return `${countryCode} *** *** ${lastThree}`;
}

/**
 * Get initials from a name for privacy masking
 * 
 * @param {string} name - Full name (e.g., "Edyelu Andrew")
 * @returns {string} Initials (e.g., "E.A.")
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') return 'N/A';
  
  return name
    .split(' ')
    .map(word => word[0]?.toUpperCase() || '')
    .filter(Boolean)
    .join('.')
    .concat('.');
}

/**
 * Sanitize phone number for logging (never log full phone)
 * 
 * @param {string} phone - Full phone number
 * @returns {string} Sanitized for logs (e.g., "+256...334")
 */
export function sanitizePhoneForLogging(phone) {
  if (!phone || typeof phone !== 'string') return '[unknown]';
  
  const digits = phone.replace(/\D/g, '');
  const lastThree = digits.slice(-3);
  
  return `[phone ending in ${lastThree}]`;
}

export default {
  maskPhoneNumber,
  getInitials,
  sanitizePhoneForLogging,
};
