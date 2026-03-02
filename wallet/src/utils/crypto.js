/**
 * Crypto utilities for phone number hashing and masking.
 * Phone numbers are hashed client-side — the actual number
 * never leaves the device.
 */

/**
 * Normalize a phone number to E.164 format and SHA-256 hash it.
 * Returns hex digest string.
 */
export async function hashPhoneNumber(phoneNumber) {
  const normalized = phoneNumber.replace(/[\s\-()]/g, '')
  const encoder = new TextEncoder()
  const data = encoder.encode(normalized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Mask a phone number showing only country code and last 4 digits.
 * +256700123456 → +256 *** *** 3456
 */
export function maskPhoneNumber(phoneNumber) {
  const cleaned = phoneNumber.replace(/[\s\-()]/g, '')
  if (cleaned.length < 8) return cleaned
  const countryCode = cleaned.slice(0, cleaned.startsWith('+') ? 4 : 0)
  const lastFour = cleaned.slice(-4)
  return `${countryCode} *** *** ${lastFour}`
}

/**
 * Truncate a Stellar address for display.
 * GABCD...WXYZ showing first 6 and last 6 characters.
 */
export function truncateAddress(address) {
  if (!address || address.length < 16) return address || ''
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}
