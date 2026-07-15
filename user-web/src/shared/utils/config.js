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
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  return raw.replace(/\/+$/, '')
}

const HORIZON_BY_NETWORK = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
}

/** Horizon URL — env override, else default for active network (testnet default). */
export function getHorizonUrl() {
  const explicit = import.meta.env.VITE_STELLAR_HORIZON_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const net = import.meta.env.VITE_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
  return HORIZON_BY_NETWORK[net]
}

/** True when stellar.toml should be fetched from VITE_API_URL (not StellarToml.Resolver). */
export function shouldFetchTomlFromApi() {
  if (import.meta.env.VITE_API_URL?.trim()) return true
  const domain = getHomeDomain()
  // API hosts (Render, Railway, etc.) serve toml from the backend — not a separate anchor domain
  return /^(localhost|127\.|10\.|192\.168\.|172\.|\d+\.\d+\.\d+\.\d+|.*\.onrender\.com$)/.test(domain)
}
