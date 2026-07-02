import {
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
  Horizon,
} from '@stellar/stellar-sdk'
import { CURRENT_NETWORK, STELLAR_TX_TIMEOUT_SECONDS, USDC_ISSUERS } from './constants'

const networkKey = import.meta.env.VITE_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'

/** USDC asset for the active Stellar network */
export function getUsdcAsset() {
  return new Asset('USDC', USDC_ISSUERS[networkKey])
}

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
 * Build and sign a USDC payment to escrow (buy order lock).
 */
export async function buildAndSignUsdcPayment({
  sourceSecretKey,
  destinationAddress,
  usdcAmount,
  memo,
  horizonUrl,
}) {
  const server = new Horizon.Server(horizonUrl)
  const keypair = Keypair.fromSecret(sourceSecretKey)
  const sourceAccount = await server.loadAccount(keypair.publicKey())
  const usdcAsset = getUsdcAsset()
  const amount = Number(usdcAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid USDC amount')
  }

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: CURRENT_NETWORK.passphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: usdcAsset,
        amount: amount.toFixed(7),
      })
    )
    .addMemo(Memo.text(String(memo || '').slice(0, 28)))
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

function balancesFromAccount(account) {
  const usdcAsset = getUsdcAsset()
  const xlmBalance = account.balances.find((b) => b.asset_type === 'native')
  const usdcLine = account.balances.find(
    (b) => b.asset_code === usdcAsset.code && b.asset_issuer === usdcAsset.issuer
  )
  return {
    xlm: xlmBalance ? parseFloat(xlmBalance.balance) : 0,
    usdc: usdcLine ? parseFloat(usdcLine.balance) : 0,
    hasUsdcTrustline: !!usdcLine,
  }
}

/**
 * Load account balances from Horizon.
 * Returns zero balances for unfunded accounts (404).
 */
export async function loadAccountBalances(publicKey, horizonUrl) {
  const server = new Horizon.Server(horizonUrl)
  try {
    const account = await server.loadAccount(publicKey)
    return balancesFromAccount(account)
  } catch (err) {
    if (err?.response?.status === 404) {
      return { xlm: 0, usdc: 0, hasUsdcTrustline: false }
    }
    throw err
  }
}

/**
 * Build and sign a ChangeTrust op so this wallet can receive USDC.
 */
export async function buildAndSignUsdcTrustline({ sourceSecretKey, horizonUrl }) {
  const server = new Horizon.Server(horizonUrl)
  const keypair = Keypair.fromSecret(sourceSecretKey)
  const account = await server.loadAccount(keypair.publicKey())
  const usdcAsset = getUsdcAsset()

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CURRENT_NETWORK.passphrase,
  })
    .addOperation(Operation.changeTrust({ asset: usdcAsset }))
    .setTimeout(STELLAR_TX_TIMEOUT_SECONDS)
    .build()

  txBuilder.sign(keypair)
  return txBuilder.toXDR()
}

/**
 * Add USDC trustline on-chain and return the Horizon submit result.
 */
export async function addUsdcTrustline(sourceSecretKey, horizonUrl) {
  const signedXdr = await buildAndSignUsdcTrustline({ sourceSecretKey, horizonUrl })
  return submitTransaction(signedXdr, horizonUrl)
}

function pathRecordToAssets(pathRecords) {
  if (!pathRecords?.length) return []
  return pathRecords.map((p) => {
    if (typeof p === 'string') {
      if (p === 'native') return Asset.native()
      const [code, issuer] = p.split(':')
      return new Asset(code, issuer)
    }
    if (p.asset_type === 'native') return Asset.native()
    return new Asset(p.asset_code, p.asset_issuer)
  })
}

function horizonPathRecords(result) {
  return result?.records || result?._embedded?.records || []
}

/**
 * Find the best XLM→USDC path on the Stellar DEX for receiving a USDC amount.
 */
export async function findReceiveUsdcPath({ horizonUrl, usdcAmount }) {
  const server = new Horizon.Server(horizonUrl)
  const usdcAsset = getUsdcAsset()
  const amount = Number(usdcAmount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid USDC amount')
  }

  const result = await server
    .strictReceivePaths([Asset.native()], usdcAsset, amount.toFixed(7))
    .call()

  const nativeRecords = horizonPathRecords(result).filter(
    (r) => r.source_asset_type === 'native'
  )

  if (!nativeRecords.length) {
    throw new Error('No XLM→USDC swap path found on the DEX. Fund with test XLM and try again.')
  }

  const best = nativeRecords.reduce((a, b) =>
    parseFloat(a.source_amount) < parseFloat(b.source_amount) ? a : b
  )

  return {
    sourceAmount: parseFloat(best.source_amount),
    destAmount: parseFloat(best.destination_amount),
    path: pathRecordToAssets(best.path),
  }
}

/**
 * Swap XLM → USDC into the source wallet via path payment (testnet DEX).
 */
export async function buildAndSignXlmToUsdcSwap({
  sourceSecretKey,
  usdcAmount,
  slippagePercent = 5,
  horizonUrl,
}) {
  const pathInfo = await findReceiveUsdcPath({ horizonUrl, usdcAmount })
  const sendMax = (pathInfo.sourceAmount * (1 + slippagePercent / 100)).toFixed(7)
  const destAmount = pathInfo.destAmount.toFixed(7)

  const server = new Horizon.Server(horizonUrl)
  const keypair = Keypair.fromSecret(sourceSecretKey)
  const account = await server.loadAccount(keypair.publicKey())
  const usdcAsset = getUsdcAsset()

  const txBuilder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: CURRENT_NETWORK.passphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax,
        destination: keypair.publicKey(),
        destAsset: usdcAsset,
        destAmount,
        path: pathInfo.path,
      })
    )
    .setTimeout(STELLAR_TX_TIMEOUT_SECONDS)
    .build()

  txBuilder.sign(keypair)
  return { xdr: txBuilder.toXDR(), estimatedXlm: pathInfo.sourceAmount, usdcAmount: pathInfo.destAmount }
}

/**
 * Swap XLM to USDC and submit to Horizon.
 */
export async function swapXlmToUsdc({ sourceSecretKey, usdcAmount, horizonUrl, slippagePercent = 5 }) {
  const { xdr, estimatedXlm, usdcAmount: received } = await buildAndSignXlmToUsdcSwap({
    sourceSecretKey,
    usdcAmount,
    slippagePercent,
    horizonUrl,
  })
  const result = await submitTransaction(xdr, horizonUrl)
  return { ...result, estimatedXlm, usdcAmount: received }
}
