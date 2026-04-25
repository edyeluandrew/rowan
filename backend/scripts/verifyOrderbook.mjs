#!/usr/bin/env node
/**
 * verifyOrderbook.mjs
 *
 * Queries Horizon's /order_book for XLM (selling) → USDC (buying) and prints
 * the top of book + total bid depth. Useful for confirming the market maker's
 * sell-USDC offers are visible to escrow's strict-receive path query.
 *
 * Read-only. Exits 0 if any asks exist, 1 if the book is empty.
 *
 * Usage: node backend/scripts/verifyOrderbook.mjs
 */
import { USDC_ASSET } from '../src/config/stellar.js';
import config from '../src/config/index.js';

const url =
  `${config.stellar.horizonUrl}/order_book?` +
  `selling_asset_type=native&` +
  `buying_asset_type=credit_alphanum4&` +
  `buying_asset_code=${USDC_ASSET.code}&` +
  `buying_asset_issuer=${encodeURIComponent(USDC_ASSET.issuer)}&` +
  `limit=10`;

(async () => {
  console.log(`\n[verifyOrderbook] ${url}\n`);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`❌ HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const book = await res.json();
  console.log('Asks (sellers of USDC, priced in XLM/USDC):');
  if (!book.asks?.length) {
    console.log('  (empty)');
  } else {
    book.asks.slice(0, 5).forEach((a, i) =>
      console.log(`  #${i + 1}  price=${a.price} XLM/USDC, amount=${a.amount} USDC`)
    );
  }
  console.log('\nBids (buyers of USDC):');
  if (!book.bids?.length) {
    console.log('  (empty)');
  } else {
    book.bids.slice(0, 5).forEach((b, i) =>
      console.log(`  #${i + 1}  price=${b.price} XLM/USDC, amount=${b.amount} USDC`)
    );
  }
  const ok = (book.asks?.length || 0) > 0;
  console.log(`\nResult: ${ok ? '✅ Book has asks (escrow can buy USDC)' : '❌ Empty asks (escrow strict-receive will fail)'}\n`);
  process.exit(ok ? 0 : 1);
})();
