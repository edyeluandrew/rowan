import client from './client'

const FUND_RETRIES = 4
const FUND_RETRY_MS = 4000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function postWithRetry(path, publicKey) {
  let lastErr
  for (let attempt = 1; attempt <= FUND_RETRIES; attempt += 1) {
    try {
      const { data } = await client.post(path, { publicKey })
      return data
    } catch (err) {
      if (err.response?.status === 503) return null
      lastErr = err
      if (attempt < FUND_RETRIES) {
        await sleep(FUND_RETRY_MS * attempt)
      }
    }
  }
  throw new Error(lastErr?.response?.data?.error || lastErr?.message || 'Could not reach Rowan funding')
}

/**
 * Ask Rowan to send ~2 XLM so this wallet exists and can open USDC.
 */
export async function requestBackendActivateAccount(publicKey) {
  if (!publicKey) return null
  return postWithRetry('/api/v1/testnet/activate-account', publicKey)
}

/**
 * Ask Rowan backend to send starter testnet USDC (direct payment).
 * Works before wallet registration. Retries for Render cold starts.
 */
export async function requestBackendTestnetUsdc(publicKey) {
  if (!publicKey) return null
  return postWithRetry('/api/v1/testnet/fund-usdc', publicKey)
}
