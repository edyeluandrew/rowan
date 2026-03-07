import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
  Horizon,
} from '@stellar/stellar-sdk'
import { CURRENT_NETWORK, STELLAR_TX_TIMEOUT_SECONDS } from './constants'

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

  const networkPassphrase = CURRENT_NETWORK.passphrase

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
    .setTimeout(STELLAR_TX_TIMEOUT_SECONDS)
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
    CURRENT_NETWORK.passphrase
  )
  try {
    return await server.submitTransaction(transaction)
  } catch (err) {
    const codes = err?.response?.data?.extras?.result_codes
    if (codes) {
      const opCodes = codes.operations?.join(', ') || ''
      const txCode = codes.transaction || ''
      throw new Error(
        `Transaction failed: ${txCode}${opCodes ? ` (${opCodes})` : ''}`
      )
    }
    throw err
  }
}

/**
 * Load account balances from Horizon.
 * Returns { xlm: 0 } for unfunded accounts (404).
 */
export async function loadAccountBalances(publicKey, horizonUrl) {
  const server = new Horizon.Server(horizonUrl)
  try {
    const account = await server.loadAccount(publicKey)
    const xlmBalance = account.balances.find(
      (b) => b.asset_type === 'native'
    )
    return {
      xlm: xlmBalance ? parseFloat(xlmBalance.balance) : 0,
    }
  } catch (err) {
    if (err?.response?.status === 404) {
      return { xlm: 0 }
    }
    throw err
  }
}
