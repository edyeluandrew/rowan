import express from 'express';
import StellarSdk from '@stellar/stellar-sdk';
import config from '../config/index.js';

const router = express.Router();

/**
 * SEP-1: stellar.toml
 * Required by the Stellar ecosystem for service discoverability.
 * Must be served at /.well-known/stellar.toml
 * Must have Access-Control-Allow-Origin: * header
 *
 * Reference: developers.stellar.org/docs/build/apps/wallet/sep10
 * Reference: github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md
 */
router.get('/stellar.toml', (req, res) => {
  // Debug logging to verify API_URL is read correctly
  console.log('[stellar.toml] process.env.API_URL =', process.env.API_URL);
  console.log('[stellar.toml] All env keys:', Object.keys(process.env).filter(k => k.includes('API')));
  
  // CORS must be * specifically for stellar.toml per SEP-1 spec
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  const network = process.env.STELLAR_NETWORK || 'testnet';
  const isMainnet = network === 'mainnet';

  const toml = `
# Rowan stellar.toml
# SEP-1 compliant service discovery file
# https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md

VERSION = "1.0.0"

NETWORK_PASSPHRASE = "${
    isMainnet
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET
  }"

# SEP-10 Web Authentication endpoint
# Wallets fetch challenge transactions from this endpoint
WEB_AUTH_ENDPOINT = "${process.env.API_URL}/api/v1/auth/challenge"

# The signing key used to sign SEP-10 challenge transactions
# Wallets verify server signatures against this key
SIGNING_KEY = "${process.env.SEP10_SIGNING_KEY}"

# All Stellar accounts controlled by Rowan
ACCOUNTS = [
  "${process.env.ESCROW_PUBLIC_KEY}"
]

[DOCUMENTATION]
ORG_NAME = "Rowan"
ORG_URL = "https://rowan.app"
ORG_DESCRIPTION = "Instant XLM to mobile money cashouts for East Africa"
ORG_TWITTER = "rowan_app"

[[CURRENCIES]]
code = "USDC"
issuer = "${config.usdcIssuerMainnet}"
status = "live"
is_asset_anchored = false
desc = "USD Coin used for OTC trader escrow settlement"

[[CURRENCIES]]
code = "native"
status = "live"
is_asset_anchored = false
anchor_asset_type = "crypto"
desc = "XLM accepted from users for mobile money cashout"
`.trim();

  res.send(toml);
});

export default router;
