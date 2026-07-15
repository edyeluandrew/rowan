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
import { getApiUrl, getHomeDomain, shouldFetchTomlFromApi } from '../../shared/utils/config.js'

// ── stellar.toml cache (one fetch per session per domain) ───────────
const tomlCache = new Map()

const TOML_FETCH_RETRIES = 3
const TOML_FETCH_RETRY_MS = 4000

function parseTomlText(text) {
  const toml = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*"([^"]*)"/)
    if (match) toml[match[1]] = match[2]
  }
  return toml
}

async function fetchTomlFromApi(apiUrl) {
  let lastErr
  for (let attempt = 1; attempt <= TOML_FETCH_RETRIES; attempt += 1) {
    try {
      const resp = await fetch(`${apiUrl}/.well-known/stellar.toml`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return parseTomlText(await resp.text())
    } catch (err) {
      lastErr = err
      if (attempt < TOML_FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, TOML_FETCH_RETRY_MS))
      }
    }
  }
  throw lastErr
}

/**
 * Fetches stellar.toml from the server's home domain and returns
 * the SIGNING_KEY and WEB_AUTH_ENDPOINT fields.
 * Per SEP-1: served at https://DOMAIN/.well-known/stellar.toml
 * Per SEP-10: SIGNING_KEY and WEB_AUTH_ENDPOINT are required fields.
 *
 * For localhost development: fetches directly from the API backend.
 *
 * @param {string} homeDomain — e.g. "rowan.app" or "localhost"
 * @returns {Promise<{ signingKey: string, webAuthEndpoint: string, networkPassphrase: string|null }>}
 */
export async function fetchStellarToml(homeDomain = getHomeDomain()) {
  const domain = homeDomain || getHomeDomain()
  if (tomlCache.has(domain)) {
    return tomlCache.get(domain)
  }

  try {
    let toml
    const apiUrl = getApiUrl()

    // Deployed API (Render, local dev): fetch toml from backend directly.
    // StellarToml.Resolver is only for a dedicated anchor HOME_DOMAIN.
    if (shouldFetchTomlFromApi()) {
      toml = await fetchTomlFromApi(apiUrl)
    } else {
      try {
        toml = await StellarToml.Resolver.resolve(domain)
      } catch {
        toml = await fetchTomlFromApi(apiUrl)
      }
    }

    if (!toml.SIGNING_KEY) {
      throw new Error(
        `stellar.toml at ${domain} is missing required SIGNING_KEY field`
      )
    }

    if (!toml.WEB_AUTH_ENDPOINT) {
      throw new Error(
        `stellar.toml at ${domain} is missing required WEB_AUTH_ENDPOINT field`
      )
    }

    const result = {
      signingKey: toml.SIGNING_KEY,
      webAuthEndpoint: toml.WEB_AUTH_ENDPOINT,
      networkPassphrase: toml.NETWORK_PASSPHRASE || null,
    }

    tomlCache.set(domain, result)
    return result
  } catch (err) {
    const hint = shouldFetchTomlFromApi()
      ? ' (API may be waking up on Render — wait ~60s and retry)'
      : ''
    throw new Error(
      `Failed to fetch stellar.toml from ${domain}: ${err.message}${hint}`
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
