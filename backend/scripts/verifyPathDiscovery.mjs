#!/usr/bin/env node
/**
 * verifyPathDiscovery.mjs
 *
 * Replicates exactly the request quoteEngine.getStrictReceivePath() builds, for
 * a sample 1.0 USDC target. Confirms whether the path the escrow swap relies on
 * actually exists. If records is empty, quotes will be marked legacy-fallback
 * and the escrow will REFUSE to swap on them.
 *
 * Read-only. Exits 0 if records.length > 0, 1 otherwise.
 *
 * Usage: node backend/scripts/verifyPathDiscovery.mjs [usdcTarget]
 */
import { USDC_ASSET } from '../src/config/stellar.js';
import config from '../src/config/index.js';

const usdcTarget = Number(process.argv[2] || '1.0');
const sourceAddr = config.stellar.marketMakerPublicKey || config.stellar.escrowPublicKey;
const destAddr = config.stellar.escrowPublicKey;

const url =
  `${config.stellar.horizonUrl}/paths/strict-receive?` +
  `source_account=${encodeURIComponent(sourceAddr)}&` +
  `destination_account=${encodeURIComponent(destAddr)}&` +
  `destination_asset_type=credit_alphanum4&` +
  `destination_asset_code=${USDC_ASSET.code}&` +
  `destination_asset_issuer=${encodeURIComponent(USDC_ASSET.issuer)}&` +
  `destination_amount=${usdcTarget.toFixed(7)}`;

(async () => {
  console.log(`\n[verifyPathDiscovery] target=${usdcTarget} USDC, source=${sourceAddr.slice(0, 8)}…, dest=${destAddr.slice(0, 8)}…`);
  console.log(`URL: ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`❌ HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  const records = data.records || [];
  console.log(`Records returned: ${records.length}`);
  records.slice(0, 3).forEach((r, i) => {
    const hops = (r.path || []).map((a) => a.asset_code || 'XLM').join(' → ') || 'direct';
    console.log(`  #${i + 1}  send=${r.source_amount} XLM → recv=${r.destination_amount} USDC  (path: ${hops})`);
  });
  const ok = records.length > 0;
  console.log(`\nResult: ${ok ? '✅ Path exists (escrow swap will work)' : '❌ No path (quote will be legacy-fallback, swap REFUSED)'}\n`);
  process.exit(ok ? 0 : 1);
})();
