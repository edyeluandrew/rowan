import client from './client'

/**
 * Request a SEP-10 challenge XDR from the server.
 * Uses the dynamic WEB_AUTH_ENDPOINT from stellar.toml when provided,
 * falling back to the default API path for backward compatibility.
 * Per SEP-10 spec the query parameter is named 'account'.
 *
 * @param {string} account          – the user's G… public key
 * @param {string} [webAuthEndpoint] – from stellar.toml WEB_AUTH_ENDPOINT
 * @returns {Promise<{ transaction: string, networkPassphrase: string }>}
 */
export function getChallenge(account, webAuthEndpoint) {
  const url = webAuthEndpoint || '/api/v1/auth/challenge'
  return client.get(url, {
    params: { account },
  })
}

/**
 * Submit a signed SEP-10 challenge XDR for an existing user (login).
 * Returns { token, user }.
 */
export function submitChallenge(transaction) {
  return client.post('/api/v1/auth/submit', { transaction })
}

/**
 * Register a new user with a signed SEP-10 challenge XDR + phone hash.
 * Returns { token, user }.
 */
export function registerUser({ transaction, phoneHash }) {
  return client.post('/api/v1/auth/register', { transaction, phoneHash })
}
