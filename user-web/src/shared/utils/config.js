/**
 * Resolve SEP-10 home domain from env.
 * Falls back to hostname of VITE_API_URL, then localhost.
 */
export function getHomeDomain() {
  const explicit = import.meta.env.VITE_HOME_DOMAIN
  if (explicit && explicit.trim()) return explicit.trim()

  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl) {
    try {
      return new URL(apiUrl).hostname
    } catch {
      /* invalid URL */
    }
  }

  return 'localhost'
}

export function getApiUrl() {
  return import.meta.env.VITE_API_URL || 'http://localhost:4000'
}
