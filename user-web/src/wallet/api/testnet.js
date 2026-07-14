import client from './client'

/**
 * Ask Rowan backend to send starter testnet USDC (direct payment).
 * Works before wallet registration. Returns null if faucet unavailable.
 */
export async function requestBackendTestnetUsdc(publicKey) {
  if (!publicKey) return null
  try {
    const { data } = await client.post('/api/v1/testnet/fund-usdc', { publicKey })
    return data
  } catch (err) {
    if (err.response?.status === 503) return null
    throw new Error(err.response?.data?.error || 'Could not get test USDC from server')
  }
}
