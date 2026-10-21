const SITE_HOSTS = new Set(['rowanpay.app', 'www.rowanpay.app', 'partners.rowanpay.app'])

function configuredApiUrl() {
  const raw = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  return raw.replace(/\/+$/, '')
}

/**
 * Resolve SEP-10 home domain from env.
 * Stays the configured API host even when requests go through rowanpay.app.
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
  if (typeof window !== 'undefined' && SITE_HOSTS.has(window.location.hostname)) {
    try {
      const apiHost = new URL(configured).hostname
      if (apiHost.endsWith('.onrender.com')) return window.location.origin
    } catch {
      /* keep the configured URL */
    }
  }
  return configured
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
