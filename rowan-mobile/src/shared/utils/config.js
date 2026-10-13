import { Capacitor } from '@capacitor/core'

/**
 * Phone networks that cannot resolve onrender.com still reach rowanpay.app.
 * Vercel forwards /api, /.well-known, and /socket.io to the Render API.
 * SEP-10 home domain stays the configured API host so challenges still match.
 */
const REACHABLE_API_ORIGIN = 'https://rowanpay.app'

function configuredApiUrl() {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  return raw.replace(/\/+$/, '')
}

/**
 * Resolve SEP-10 home domain from env.
 * Falls back to hostname of VITE_API_URL, then localhost.
 */
export function getHomeDomain() {
  const explicit = import.meta.env.VITE_HOME_DOMAIN
  if (explicit && explicit.trim()) return explicit.trim()

  try {
    return new URL(configuredApiUrl()).hostname
  } catch {
    return 'localhost'
  }
}

export function getApiUrl() {
  const configured = configuredApiUrl()
  try {
    const host = new URL(configured).hostname
    if (host.endsWith('.onrender.com') && Capacitor.isNativePlatform()) {
      return REACHABLE_API_ORIGIN
    }
  } catch {
    /* keep the configured URL */
  }
  return configured
}

/** True when stellar.toml should be fetched from VITE_API_URL (not StellarToml.Resolver). */
export function shouldFetchTomlFromApi() {
  if (import.meta.env.VITE_API_URL?.trim()) return true
  const domain = getHomeDomain()
  return /^(localhost|127\.|10\.|192\.168\.|172\.|\d+\.\d+\.\d+\.\d+|.*\.onrender\.com$)/.test(domain)
}
