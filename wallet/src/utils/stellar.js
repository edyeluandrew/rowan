import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
  Horizon,
} from '@stellar/stellar-sdk'

/**
 * Generate a new random Stellar keypair.
 * Returns { publicKey, secretKey }.
 */
export function generateKeypair() {
  const keypair = Keypair.random()
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  }
}

/**
 * Reconstruct a Keypair object from a secret key string.
 */
export function keypairFromSecret(secretKey) {
  return Keypair.fromSecret(secretKey)
}

/**
 * Validate a Stellar public key (G...).
 */
export function isValidPublicKey(address) {
  try {
    Keypair.fromPublicKey(address)
    return true
  } catch {
    return false
  }
}

/**
 * Validate a Stellar secret key (S...).
 */
export function isValidSecretKey(secret) {
  try {
    Keypair.fromSecret(secret)
    return true
  } catch {
    return false
  }
}

/**
 * Sign a challenge nonce with the user's secret key.
 * Returns base64-encoded signature.
 */
export async function signChallenge(nonce, secretKey) {
  const keypair = Keypair.fromSecret(secretKey)
  const hash = Buffer.from(nonce, 'utf8')
  const signature = keypair.sign(hash)
  return Buffer.from(signature).toString('base64')
}

/**
 * Build and sign a payment transaction, sending XLM
 * from the user's wallet to the escrow address.
 *
 * Returns the signed transaction XDR string ready for
 * submission to Horizon.
 */
export async function buildAndSignPayment({
  sourceSecretKey,
  destinationAddress,
  xlmAmount,
  memo,
  horizonUrl,
}) {
  const server = new Horizon.Server(horizonUrl)
  const keypair = Keypair.fromSecret(sourceSecretKey)
  const sourceAccount = await server.loadAccount(keypair.publicKey())

  const networkPassphrase =
    import.meta.env.VITE_STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: Asset.native(),
        amount: String(xlmAmount),
      })
    )
    .addMemo(Memo.text(memo))
    .setTimeout(180)
    .build()

  txBuilder.sign(keypair)
  return txBuilder.toXDR()
}

/**
 * Submit a signed transaction XDR to Horizon.
 */
export async function submitTransaction(signedXdr, horizonUrl) {
  const server = new Horizon.Server(horizonUrl)
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    import.meta.env.VITE_STELLAR_NETWORK === 'mainnet'
      ? Networks.PUBLIC
      : Networks.TESTNET
  )
  return server.submitTransaction(transaction)
}

/**
 * Load account balances from Horizon.
 */
export async function loadAccountBalances(publicKey, horizonUrl) {
  const server = new Horizon.Server(horizonUrl)
  const account = await server.loadAccount(publicKey)
  const xlmBalance = account.balances.find(
    (b) => b.asset_type === 'native'
  )
  return {
    xlm: xlmBalance ? parseFloat(xlmBalance.balance) : 0,
  }
}
