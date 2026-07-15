import client from './client'

const FUND_RETRIES = 4
const FUND_RETRY_MS = 4000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Ask Rowan backend to send starter testnet USDC (direct payment).
 * Works before wallet registration. Retries for Render cold starts.
 */
export async function requestBackendTestnetUsdc(publicKey) {
  if (!publicKey) return null

  let lastErr
  for (let attempt = 1; attempt <= FUND_RETRIES; attempt += 1) {
    try {
      const { data } = await client.post('/api/v1/testnet/fund-usdc', { publicKey })
      return data
    } catch (err) {
      if (err.response?.status === 503) return null
      lastErr = err
      if (attempt < FUND_RETRIES) {
        await sleep(FUND_RETRY_MS * attempt)
      }
    }
  }

  throw new Error(lastErr?.response?.data?.error || lastErr?.message || 'Could not get test USDC from server')
}
