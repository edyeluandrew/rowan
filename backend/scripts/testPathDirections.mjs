#!/usr/bin/env node
/**
 * Test both directions of path discovery
 */
import { USDC_ASSET } from '../src/config/stellar.js';
import config from '../src/config/index.js';

const MM = 'GCKSEJOEMXEGHE675YMWSGFI2LX7XX6DBBJ7IWN3QN2N7645EYLV2LRF';
const ESCROW = 'GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA';
const TARGET = '1.0';

async function testPath(source, dest, label) {
  const url =
    `${config.stellar.horizonUrl}/paths/strict-receive?` +
    `source_account=${encodeURIComponent(source)}&` +
    `destination_account=${encodeURIComponent(dest)}&` +
    `destination_asset_type=credit_alphanum4&` +
    `destination_asset_code=${USDC_ASSET.code}&` +
    `destination_asset_issuer=${encodeURIComponent(USDC_ASSET.issuer)}&` +
    `destination_amount=${TARGET}`;

  console.log(`\n${label}`);
  console.log(`Source: ${source.slice(0, 8)}...`);
  console.log(`Dest: ${dest.slice(0, 8)}...`);
  
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) {
      console.log(`HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    const count = data.records?.length || 0;
    console.log(`✅ ${count} path(s) found`);
    if (count > 0) {
      console.log(`   Path: ${data.records[0].source_amount} XLM → ${data.records[0].destination_amount} USDC`);
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
  }
}

console.log(`Target: ${TARGET} USDC\n`);
console.log(`=`.repeat(60));

await testPath(MM, ESCROW, 'Config: MM → ESCROW (current)');
await testPath(ESCROW, MM, 'Test: ESCROW → MM (reversed)');

console.log(`\n` + `=`.repeat(60));
