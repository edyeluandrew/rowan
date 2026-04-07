/**
 * Agreement Response Normalizer
 *
 * Handles inconsistent API responses from /api/v1/trader/onboarding/agreement
 * The endpoint may return field names that vary:
 *   - content, agreement, or text for agreement text
 *   - version or agreementVersion for version number
 */

/**
 * Normalize agreement API response to consistent format.
 * @param {object} data - Raw response from API
 * @returns {{version: string, content: string}}
 */
export function normalizeAgreementResponse(data) {
  if (!data || typeof data !== 'object') {
    return { version: '1.0', content: '' };
  }

  // Try to extract content (try multiple field names)
  const content = data.content || data.agreement || data.text || '';

  // Try to extract version (try multiple field names)
  const version = data.version || data.agreementVersion || '1.0';

  return {
    version: String(version),
    content: String(content),
  };
}
