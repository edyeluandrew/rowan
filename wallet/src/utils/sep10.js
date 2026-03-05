/**
 * SEP-10 Web Authentication — Stellar Challenge-Response
 *
 * Implements the client side of the SEP-0010 spec using the Stellar SDK's
 * built-in utilities rather than manual verification.
 *
 * The server's SIGNING_KEY is fetched dynamically from stellar.toml (SEP-1)
 * at https://HOME_DOMAIN/.well-known/stellar.toml — never hardcoded.
 *
 * Flow:
 *   1. Fetch stellar.toml → get SIGNING_KEY + WEB_AUTH_ENDPOINT
 *   2. GET challenge XDR from WEB_AUTH_ENDPOINT
 *   3. Verify via WebAuth.readChallengeTx (all SEP-10 rules)
 *   4. Sign with user keypair
 *   5. POST signed XDR → server returns JWT
 *
 * Reference: developers.stellar.org/docs/build/apps/wallet/sep10
 */
import {
  Transaction,
  Keypair,
  StellarToml,
  WebAuth,
} from '@stellar/stellar-sdk'

// ── stellar.toml cache (one fetch per session per domain) ───────────
const tomlCache = new Map()

/**
 * Fetches stellar.toml from the server's home domain and returns
 * the SIGNING_KEY and WEB_AUTH_ENDPOINT fields.
 * Per SEP-1: served at https://DOMAIN/.well-known/stellar.toml
 * Per SEP-10: SIGNING_KEY and WEB_AUTH_ENDPOINT are required fields.
 *
 * @param {string} homeDomain — e.g. "rowan.app"
 * @returns {Promise<{ signingKey: string, webAuthEndpoint: string, networkPassphrase: string|null }>}
 */
export async function fetchStellarToml(homeDomain) {
  if (tomlCache.has(homeDomain)) {
    return tomlCache.get(homeDomain)
  }

  try {
    const toml = await StellarToml.Resolver.resolve(homeDomain)

    if (!toml.SIGNING_KEY) {
      throw new Error(
        `stellar.toml at ${homeDomain} is missing required SIGNING_KEY field`
      )
    }

    if (!toml.WEB_AUTH_ENDPOINT) {
      throw new Error(
        `stellar.toml at ${homeDomain} is missing required WEB_AUTH_ENDPOINT field`
      )
    }

    const result = {
      signingKey: toml.SIGNING_KEY,
      webAuthEndpoint: toml.WEB_AUTH_ENDPOINT,
      networkPassphrase: toml.NETWORK_PASSPHRASE || null,
    }

    tomlCache.set(homeDomain, result)
    return result
  } catch (err) {
    throw new Error(
      `Failed to fetch stellar.toml from ${homeDomain}: ${err.message}`
    )
  }
}

/**
 * Verify that a challenge XDR received from the server is a valid
 * SEP-10 challenge transaction using the SDK's WebAuth.readChallengeTx.
 *
 * This replaces a manual 8-rule check with the SDK's battle-tested
 * implementation which validates: sequence 0, server signature,
 * ManageData op, home domain, nonce length, and time bounds.
 *
 * @param {object} opts
 * @param {string} opts.challengeXdr      – base64 XDR transaction envelope
 * @param {string} opts.serverSigningKey  – G… from stellar.toml SIGNING_KEY
 * @param {string} opts.networkPassphrase – Stellar network passphrase
 * @param {string} opts.homeDomain        – e.g. 'rowan.app'
 * @param {string} opts.clientPublicKey   – the user's G… address
 * @returns {true} or throws with a human-readable reason
 */
export function verifyChallengeTransaction({
  challengeXdr,
  serverSigningKey,
  networkPassphrase,
  homeDomain,
  clientPublicKey,
}) {
  try {
    const result = WebAuth.readChallengeTx(
      challengeXdr,
      serverSigningKey,
      networkPassphrase,
      homeDomain,
      homeDomain // webAuthDomain — same as homeDomain for first-party wallets
    )

    // Additionally verify the challenge was issued for the correct user
    if (result.clientAccountID !== clientPublicKey) {
      throw new Error(
        'SEP-10 challenge was issued for a different account'
      )
    }

    return true
  } catch (err) {
    throw new Error(`SEP-10 verification failed: ${err.message}`)
  }
}

/**
 * Sign a SEP-10 challenge XDR with the user's secret key.
 *
 * @param {string} xdr              – base64 XDR transaction envelope
 * @param {string} secretKey         – the user's S… secret
 * @param {string} networkPassphrase – e.g. Networks.TESTNET
 * @returns {string} the signed XDR envelope (base64)
 */
export function signChallengeTransaction(xdr, secretKey, networkPassphrase) {
  const tx = new Transaction(xdr, networkPassphrase)
  const keypair = Keypair.fromSecret(secretKey)
  tx.sign(keypair)
  return tx.toXDR()
}
