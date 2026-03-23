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
export async function getChallenge(account, webAuthEndpoint) {
  const url = webAuthEndpoint || '/api/v1/auth/challenge'
  const response = await client.get(url, {
    params: { account },
  })
  return response.data
}

/**
 * Submit a signed SEP-10 challenge XDR for an existing user (login).
 * Returns { token, user }.
 */
export async function submitChallenge(transaction) {
  const response = await client.post('/api/v1/auth/submit', { transaction })
  return response.data
}

/**
 * Register a new user with a signed SEP-10 challenge XDR + phone hash.
 * Returns { token, user }.
 */
export async function registerUser({ transaction, phoneHash }) {
  console.log('[registerUser API] Sending transaction:', transaction?.substring(0, 50) + '...');
  console.log('[registerUser API] Transaction type:', typeof transaction);
  console.log('[registerUser API] Transaction length:', transaction?.length);
  const response = await client.post('/api/v1/auth/register', { transaction, phoneHash })
  return response.data
}
