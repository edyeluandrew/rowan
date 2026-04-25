#!/usr/bin/env node
/**
 * verifyTrustlines.mjs
 *
 * Asserts that:
 *   - The escrow account has a USDC trustline with the configured issuer
 *   - The market maker account (if configured) has a USDC trustline with the same issuer
 *
 * Read-only. Exits 0 on success, 1 on any missing/mismatched trustline.
 *
 * Usage: node backend/scripts/verifyTrustlines.mjs
 */
import { server as horizon, USDC_ASSET } from '../src/config/stellar.js';
import config from '../src/config/index.js';

async function checkAccount(label, publicKey) {
  if (!publicKey) {
    console.log(`  ${label}: NOT CONFIGURED (skipping)`);
    return { ok: true, skipped: true };
  }
  try {
    const account = await horizon.loadAccount(publicKey);
    const line = account.balances.find(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
    if (!line) {
      console.log(`  ${label} (${publicKey.slice(0, 8)}…): ❌ NO USDC trustline for issuer ${USDC_ASSET.issuer.slice(0, 8)}…`);
      return { ok: false };
    }
    console.log(`  ${label} (${publicKey.slice(0, 8)}…): ✅ trustline OK, balance=${line.balance}`);
    return { ok: true };
  } catch (err) {
    console.log(`  ${label} (${publicKey.slice(0, 8)}…): ❌ loadAccount failed: ${err.message}`);
    return { ok: false };
  }
}

(async () => {
  console.log(`\n[verifyTrustlines] network=${config.stellar.network}, USDC issuer=${USDC_ASSET.issuer}\n`);
  const escrow = await checkAccount('Escrow      ', config.stellar.escrowPublicKey);
  const mm = await checkAccount('MarketMaker ', config.stellar.marketMakerPublicKey);
  const ok = escrow.ok && mm.ok;
  console.log(`\nResult: ${ok ? '✅ PASS' : '❌ FAIL'}\n`);
  process.exit(ok ? 0 : 1);
})();
