import { CURRENT_NETWORK } from './constants'

/** Fund a Stellar testnet account via Friendbot. No-op on mainnet. */
export async function fundWithFriendbot(publicKey) {
  if (!publicKey) throw new Error('Wallet address required')
  if (!CURRENT_NETWORK.friendbotUrl) {
    throw new Error('Testnet funding is not available on this network')
  }

  const res = await fetch(
    `${CURRENT_NETWORK.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`
  )
  if (!res.ok) throw new Error('Friendbot request failed')
}
