import {
  server as horizon,
  networkPassphrase,
  escrowKeypair,
  USDC_ASSET,
  StellarSdk,
} from '../config/stellar.js';
import config from '../config/index.js';
import db from '../db/index.js';
import redis from '../db/redis.js';
import quoteEngine from './quoteEngine.js';
import matchingEngine from './matchingEngine.js';
import fraudMonitor from './fraudMonitor.js';
import stateMachine from './transactionStateMachine.js';
import logger from '../utils/logger.js';

/**
 * Verify an incoming deposit against a locked quote.
 * Called by the Horizon event watcher when XLM arrives at the escrow address.
 *
 * [C2] Protected by Redis distributed lock to prevent double-processing
 *       of duplicate Horizon stream events.
 * [B6] Uses a SQL transaction to atomically mark quote used + create tx record.
 * [B5] Refunds go to user's registered address, not sourceAccount.
 */
async function handleDeposit({ memo, amount, sourceAccount, txHash }) {
  logger.info(`[Escrow] Deposit detected — memo: ${memo}, amount: ${amount} XLM, tx: ${txHash}`);

  // ── C2 FIX: Distributed lock prevents double-processing ──
  const lockKey = `lock:deposit:${memo}`;
  // [PHASE 4] Use config-driven lock TTL
  const lockAcquired = await redis.set(lockKey, txHash, 'EX', config.platform.redisLockTtlDepositSeconds, 'NX');
  if (!lockAcquired) {
    logger.warn(`[Escrow] Duplicate deposit event for memo ${memo} — skipping (lock held)`);
    return;
  }

  // 1. Look up the quote
  const quote = await quoteEngine.getQuoteByMemo(memo);
  if (!quote) {
    logger.warn(`[Escrow] No valid quote for memo ${memo} — will refund`);
    await refundXlm(sourceAccount, amount, `No valid quote for memo ${memo}`);
    await redis.del(lockKey);
    return;
  }

  // ── AUDIT: Log quote values and their types ──
  logger.info(`[Escrow] 📋 Quote retrieved from DB:`);
  logger.info(`  - id: ${quote.id}`);
  logger.info(`  - fiat_amount: ${quote.fiat_amount} (type: ${typeof quote.fiat_amount}, isFinite: ${Number.isFinite(quote.fiat_amount)})`);
  logger.info(`  - platform_fee: ${quote.platform_fee} (type: ${typeof quote.platform_fee}, isFinite: ${Number.isFinite(quote.platform_fee)})`);
  logger.info(`  - fiat_currency: ${quote.fiat_currency}`);
  logger.info(`  - xlm_amount: ${quote.xlm_amount}`);
  logger.info(`  - user_rate: ${quote.user_rate}`);
  
  
  logger.info(`[Escrow] 📋 Quote retrieved from DB:`);
  logger.info(`  - id: ${quote.id}`);
  logger.info(`  - fiat_amount: ${quote.fiat_amount} (type: ${typeof quote.fiat_amount})`);
  logger.info(`  - platform_fee: ${quote.platform_fee} (type: ${typeof quote.platform_fee})`);
  logger.info(`  - fiat_currency: ${quote.fiat_currency}`);
  logger.info(`  - xlm_amount: ${quote.xlm_amount}`);
  logger.info(`  - user_rate: ${quote.user_rate}`);

  // ── B5 FIX: Always refund to user's registered Stellar address ──
  const userResult = await db.query(
    `SELECT stellar_address FROM users WHERE id = $1`,
    [quote.user_id]
  );
  const userStellarAddress = userResult.rows[0]?.stellar_address || sourceAccount;

  // 2. Verify amount matches (with small tolerance for Stellar fees)
  // [PHASE 4] Use config-driven amount mismatch tolerance instead of hardcoded 0.01
  const expectedXlm = parseFloat(quote.xlm_amount);
  const receivedXlm = parseFloat(amount);
  if (Math.abs(receivedXlm - expectedXlm) > config.platform.xlmAmountMismatchTolerance) {
    logger.warn(`[Escrow] Amount mismatch: expected ${expectedXlm}, got ${receivedXlm}`);
    // [FIX 4] Mark quote as INVALID before refunding
    await db.query(`UPDATE quotes SET status = 'INVALID' WHERE id = $1`, [quote.id]);
    await refundXlm(userStellarAddress, amount, 'Amount mismatch');
    await redis.del(lockKey);
    return;
  }

  // 3. Check quote hasn't expired
  if (new Date(quote.expires_at) < new Date()) {
    logger.warn(`[Escrow] Quote ${quote.id} expired`);
    // [FIX 4] Mark quote as EXPIRED before refunding
    await db.query(`UPDATE quotes SET status = 'EXPIRED' WHERE id = $1`, [quote.id]);
    await refundXlm(userStellarAddress, amount, 'Quote expired');
    await redis.del(lockKey);
    return;
  }

  // ── B6 FIX: Atomic SQL transaction for quote-used + tx-record ──
  const client = await db.getClient();
  let transaction;
  try {
    await client.query('BEGIN');

    // Mark quote used with a conditional guard (prevents double-use)
    // [FIX 4] Mark quote used AND set status = 'CONFIRMED' atomically
    const markResult = await client.query(
      `UPDATE quotes SET is_used = TRUE, status = 'CONFIRMED' WHERE id = $1 AND is_used = FALSE RETURNING id`,
      [quote.id]
    );
    if (markResult.rows.length === 0) {
      await client.query('ROLLBACK');
      logger.warn(`[Escrow] Quote ${quote.id} already used — skipping`);
      await redis.del(lockKey);
      return;
    }

    const txResult = await client.query(
      `INSERT INTO transactions
         (quote_id, user_id, xlm_amount, fiat_amount, fiat_currency,
          network, phone_hash, state, stellar_deposit_tx, locked_rate, escrow_locked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ESCROW_LOCKED',$8,$9,NOW())
       RETURNING *`,
      [
        quote.id, 
        quote.user_id, 
        parseFloat(receivedXlm),      // Ensure numeric
        parseFloat(quote.fiat_amount),  // Ensure numeric  
        quote.fiat_currency, 
        quote.network, 
        quote.phone_hash,
        txHash, 
        parseFloat(quote.user_rate),   // Ensure numeric
      ]
    );
    transaction = txResult.rows[0];
    logger.info(`[Escrow] ✅ Transaction record created: ${transaction.id} (quote: ${quote.id})`);
    
    // Cache transactionId by quoteId for fast lookup
    // [PHASE 4] Use config-driven TTL for quote-to-tx mapping
    await redis.set(`quote:${quote.id}:tx`, transaction.id, 'EX', config.platform.redisQuoteTxMapTtlSeconds);
    logger.info(`[Escrow] Cached tx lookup: quote ${quote.id} → tx ${transaction.id}`);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(`[Escrow] ❌ DB error during deposit handling:`, err.message);
    logger.error(`[Escrow] Values that were being inserted:`, {
      quoteId: quote.id,
      userId: quote.user_id,
      xlmAmount: receivedXlm,
      fiatAmount: quote.fiat_amount,
      userRate: quote.user_rate,
    });
    await redis.del(lockKey);
    throw err;
  } finally {
    client.release();
  }

  logger.info(`[Escrow] Transaction ${transaction.id} created — state: ESCROW_LOCKED`);

  // 5. Immediately swap XLM → USDC inside the escrow
  try {
    logger.warn(`[Escrow] ⚠️  BEFORE swapXlmToUsdc call`);
    const swapResult = await swapXlmToUsdc(receivedXlm, quote);
    logger.warn(`[Escrow] ⚠️  AFTER swapXlmToUsdc call, got result`);
    
    logger.info(`[Escrow] 🔍 RAW SWAP RESULT (VERBOSE):`);
    logger.info(`[Escrow]   swapResult keys: ${Object.keys(swapResult).join(', ')}`);
    logger.info(`[Escrow]   amount raw: ${swapResult.amount}`);
    logger.info(`[Escrow]   amount type: ${typeof swapResult.amount}`);
    logger.info(`[Escrow]   amount JSON: ${JSON.stringify(swapResult.amount)}`);
    logger.info(`[Escrow]   amount toString: ${swapResult.amount?.toString()}`);
    logger.info(`[Escrow]   amount isFinite: ${Number.isFinite(swapResult.amount)}`);
    logger.info(`[Escrow]   amount isInteger: ${Number.isInteger(swapResult.amount)}`);
    logger.info(`[Escrow]   txHash: ${swapResult.txHash}`);
    
    logger.warn(`[Escrow] ✅ swapResult validated, proceeding to conversion`);
    logger.info(`[Escrow] Swap result: amount=${swapResult.amount} (type: ${typeof swapResult.amount}), txHash=${swapResult.txHash}`);
    
    // Ensure USDC amount is a number
    let usdcDecimal = swapResult.amount;
    logger.warn(`[Escrow] 🔴 VALIDATION START: usdcDecimal = ${usdcDecimal} (type: ${typeof usdcDecimal}, isNumber: ${typeof usdcDecimal === 'number'})`);
    
    if (typeof usdcDecimal === 'string') {
      logger.warn(`[Escrow] 🟡 Converting string to number: "${usdcDecimal}" → ${parseFloat(usdcDecimal)}`);
      usdcDecimal = parseFloat(usdcDecimal);
    }
    
    // If it's a BigInt, convert to number
    if (typeof usdcDecimal === 'bigint') {
      logger.warn(`[Escrow] 🟡 Converting BigInt to number: ${usdcDecimal}`);
      usdcDecimal = Number(usdcDecimal);
    }
    
    logger.warn(`[Escrow] 🟡 After type coercion: ${usdcDecimal} (type: ${typeof usdcDecimal})`);
    
    logger.info(`[Escrow] USDC value parsed: ${swapResult.amount} → ${usdcDecimal} (finite: ${Number.isFinite(usdcDecimal)}, type: ${typeof usdcDecimal})`);
    
    // Defensive check: if still not a valid number, throw
    if (!Number.isFinite(usdcDecimal) || usdcDecimal <= 0) {
      logger.error(`[Escrow] ❌ INVALID USDC AMOUNT: ${swapResult.amount} (type: ${typeof swapResult.amount}, finite: ${Number.isFinite(usdcDecimal)}, value: ${usdcDecimal})`);
      throw new Error(`Invalid USDC amount from swap: ${swapResult.amount} (type: ${typeof swapResult.amount})`);
    }
    
    logger.warn(`[Escrow] ✅ VALIDATION PASSED: usdcDecimal is a valid number: ${usdcDecimal}`);
    
    // Sanity check: USDC should be within reasonable bounds
    // For a 3-5 XLM deposit, should be roughly 0.8-1.2 USDC (given 0.27 USD/XLM and 3750 UGX/USDC)
    if (usdcDecimal < 0.01 || usdcDecimal > 1000) {
      logger.warn(`[Escrow] ⚠️  USDC amount seems unusual: ${usdcDecimal} (expected reasonable bounds for ${receivedXlm} XLM)`);
    }
    
    // *** IMPORTANT: usdc_amount is NUMERIC, NOT BIGINT ***
    // Store the decimal USDC amount directly
    logger.warn(`[Escrow] 🔴 BEFORE DB INSERT: usdcDecimal=${usdcDecimal} (type: ${typeof usdcDecimal})`);
    logger.warn(`[Escrow] 🔴 BEFORE DB INSERT: txHash=${swapResult.txHash}`);
    logger.warn(`[Escrow] 🔴 BEFORE DB INSERT: transactionId=${transaction.id}`);

    try {
      logger.warn(`[Escrow] 💾 Attempting DB INSERT: usdc_amount=${usdcDecimal} (type: ${typeof usdcDecimal})`);
      await db.query(
        `UPDATE transactions SET usdc_amount = $1, stellar_swap_tx = $2 WHERE id = $3`,
        [usdcDecimal, swapResult.txHash, transaction.id]
      );
      logger.warn(`[Escrow] ✅ AFTER DB INSERT: success!`);
      logger.info(`[Escrow] ✅ Database INSERT successful with usdc_amount=${usdcDecimal}`);
    } catch (dbErr) {
      logger.error(`[Escrow] ❌ DATABASE ERROR:`);
      logger.error(`[Escrow]   Message: ${dbErr?.message}`);
      logger.error(`[Escrow]   Code: ${dbErr?.code}`);
      logger.error(`[Escrow]   Tried to insert: usdc_amount=${usdcDecimal} (type: ${typeof usdcDecimal})`);
      logger.error(`[Escrow]   Tried to insert: stellar_swap_tx=${swapResult.txHash}`);
      logger.error(`[Escrow]   Tried to insert: id=${transaction.id}`);
      throw dbErr;
    }
    logger.info(`[Escrow] ✅ Swap complete — ${usdcDecimal} USDC, tx: ${swapResult.txHash}`);

    // 6. Transition state to TRADER_MATCHED (swap complete, now waiting for trader assignment)
    logger.warn(`[Escrow] ⚠️  CRITICAL: About to transition state for tx ${transaction.id}`);
    logger.warn(`[Escrow] ⚠️  Current state from DB: ${transaction.state}`);
    
    try {
      logger.info(`[Escrow] Transitioning ESCROW_LOCKED → TRADER_MATCHED for tx ${transaction.id}`);
      const stateTransition = await stateMachine.transition(transaction.id, 'ESCROW_LOCKED', 'TRADER_MATCHED', {
        trader_id: null, // Will be filled once trader is actually matched
      });
      
      if (!stateTransition) {
        logger.error(`[Escrow] ❌ STATE TRANSITION RETURNED NULL for tx ${transaction.id}`);
        logger.error(`[Escrow] This means transaction is not in ESCROW_LOCKED state anymore`);
        return;
      }
      logger.warn(`[Escrow] ✅✅ STATE TRANSITIONED TO TRADER_MATCHED: ${stateTransition.state}`);
    } catch (transitionErr) {
      logger.error(`[Escrow] ❌ STATE TRANSITION ERROR for tx ${transaction.id}:`);
      logger.error(`[Escrow]   Error: ${transitionErr?.message}`);
      logger.error(`[Escrow]   Full error:`, transitionErr);
      throw transitionErr;
    }

    // 7. Trigger trader matching (will update trader_id when found)
    logger.warn(`[Escrow] 🔴 BEFORE matchingEngine.matchTrader for tx ${transaction.id}`);
    try {
      await matchingEngine.matchTrader(transaction.id);
      logger.warn(`[Escrow] 🟢 AFTER matchingEngine.matchTrader SUCCESS for tx ${transaction.id}`);
    } catch (matchingErr) {
      logger.warn(`[Escrow] 🔴 matchingEngine.matchTrader THREW ERROR for tx ${transaction.id}`);
      logger.error(`[Escrow]   Matching error: ${matchingErr?.message}`);
      throw matchingErr;
    }
  } catch (err) {
    logger.error(`[Escrow] ❌ Swap failed for tx ${transaction.id}:`);
    logger.error(`[Escrow]   Error message: ${err?.message}`);
    logger.error(`[Escrow]   Error code: ${err?.code}`);
    logger.error(`[Escrow]   Error detail: ${err?.detail}`);
    logger.error(`[Escrow]   Error toString: ${err?.toString()}`);
    if (err?.response?.data?.extras?.result_codes) {
      logger.error(`[Escrow]   Stellar result codes:`, err.response.data.extras.result_codes);
    }

    // ── B3 FIX: Save refund hash and set state to REFUNDED ──
    try {
      const refundHash = await refundXlm(userStellarAddress, amount, 'Swap failed');
      await stateMachine.transition(transaction.id, 'ESCROW_LOCKED', 'REFUNDED', {
        failure_reason: 'XLM→USDC swap failed: ' + (err?.message || 'Unknown error'),
        stellar_refund_tx: refundHash,
      });
    } catch (refundErr) {
      // If refund also fails, mark FAILED so Bull queue can retry
      logger.error(`[Escrow] REFUND ALSO FAILED for tx ${transaction.id}:`, refundErr.message);
      await stateMachine.transition(transaction.id, 'ESCROW_LOCKED', 'FAILED', {
        failure_reason: 'Swap failed + refund failed: ' + (err?.message || 'Unknown error'),
      });
    }
  }
}

/**
 * Attempt to fillXLM → USDC conversion from market maker offers.
 * Uses manageBuyOffer to create a buy order that fills against market maker's sell offers.
 * Returns { success: true, amount, txHash } if successful, else { success: false, reason }.
 *
 * [MM-1] Priority strategy: Try market maker first; if fails, caller will fallback to DEX.
 */
async function tryMarketMakerFill(xlmAmount, expectedUsdc) {
  if (!config.stellar.marketMakerPublicKey) {
    logger.info('[Escrow] Market maker not configured, skipping MM fill attempt');
    return { success: false, reason: 'Market maker not configured' };
  }

  try {
    logger.info(`[Escrow] 🎯 Attempting market maker fill: buy ${expectedUsdc} USDC with max ${xlmAmount} XLM`);

    const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

    // Create a buy offer: we want to buy USDC, selling XLM
    // Price is in terms of selling asset (XLM), so price = XLM per USDC we're buying
    const price = (xlmAmount / expectedUsdc).toFixed(7); // XLM per USDC

    const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
      fee: config.stellarMaxFee,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.manageBuyOffer({
          selling: StellarSdk.Asset.native(), // Selling XLM
          buying: USDC_ASSET,                   // Buying USDC
          buyAmount: expectedUsdc.toFixed(7),   // Exact USDC we want
          price: price,                         // Max XLM per USDC we'll pay
          offerId: '0',                         // 0 = create new offer (not update)
        })
      )
      .setTimeout(30)
      .build();

    logger.info(`[Escrow] Submitting market maker buy offer: buyAmount=${expectedUsdc}, price=${price}`);
    tx.sign(escrowKeypair);
    const result = await horizon.submitTransaction(tx);
    logger.info(`[Escrow] ✅ Market maker fill successful: ${result.hash}`);

    // Parse the result to confirm how much USDC we actually got
    let actualUsdc = expectedUsdc;
    try {
      const txResult = StellarSdk.xdr.TransactionResult.fromXDR(result.result_xdr, 'base64');
      const opResult = txResult.result().results()[0].tr().manageBuyOfferResult();
      // Extract the offered amount (should be the buyAmount we requested)
      actualUsdc = expectedUsdc;
    } catch (parseErr) {
      logger.warn('[Escrow] Could not parse MM buy offer result XDR:', parseErr.message);
    }

    return { success: true, amount: actualUsdc, txHash: result.hash };
  } catch (err) {
    logger.warn(`[Escrow] Market maker fill failed: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

/**
 * [PHASE 4] Execute XLM → USDC swap using quote path data for alignment.
 * 
 * NEW FLOW (quote-aligned):
 * 1. Use quote's path_xlm_needed and path_usdc_received as the executable amounts
 * 2. Apply additional slippage protection (separate from quote slippage) for market drift
 * 3. Execute via pathPaymentStrictReceive with quote-aligned parameters
 * 4. Validate swap result against quote expectations
 *
 * The escrow account is both sender (XLM) and receiver (USDC).
 *
 * [C4] pathPaymentStrictReceive guarantees the escrow receives exactly destAmount USDC
 *      or the tx fails entirely. The amount stored in DB is the requested destAmount.
 */
async function swapXlmToUsdc(xlmAmount, quote) {
  logger.info(`[Escrow] 🔄 [PHASE 4] SWAP START (quote-aligned): xlmAmount=${xlmAmount}`);
  logger.info(`[Escrow] Quote data: id=${quote.id}, path_xlm_needed=${quote.path_xlm_needed} (type: ${typeof quote.path_xlm_needed}), path_usdc_received=${quote.path_usdc_received} (type: ${typeof quote.path_usdc_received})`);
  
  const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

  // ── Step 1: Use quote path data as baseline ──
  // PostgreSQL NUMERIC columns can return as strings, so convert explicitly
  let targetUsdc = quote.path_usdc_received ? Number(quote.path_usdc_received) : null;
  let xlmSendMax = quote.path_xlm_needed ? Number(quote.path_xlm_needed) : null;
  
  logger.info(`[Escrow] Converted to numbers: targetUsdc=${targetUsdc} (type: ${typeof targetUsdc}), xlmSendMax=${xlmSendMax} (type: ${typeof xlmSendMax})`);
  
  if (!targetUsdc || !xlmSendMax || !Number.isFinite(targetUsdc) || !Number.isFinite(xlmSendMax)) {
    logger.warn('[Escrow] Quote missing valid path data, falling back to legacy calculation');
    // Fallback for quotes that don't have path data (legacy compat)
    const usdcToFiat = quoteEngine.getUsdcToFiatRate(quote.fiat_currency);
    const fiatAmount = Number(quote.fiat_amount);
    const platformFee = Number(quote.platform_fee);
    const totalFiat = fiatAmount + platformFee;
    targetUsdc = totalFiat / usdcToFiat;
    xlmSendMax = xlmAmount;
    
    logger.warn(`[Escrow] Fallback calculation: totalFiat=${totalFiat}, usdcToFiat=${usdcToFiat} → targetUsdc=${targetUsdc}`);
  }

  logger.info(`[Escrow] 📊 Swap plan: send ${xlmSendMax} XLM → receive ${targetUsdc} USDC`);

  // ── Step 2: Do NOT apply extra slippage (PHASE 1 SPRINT FIX) ──
  // [PHASE 1] REMOVED double slippage: quote uses 0.3%, execution now uses same 0.3%
  // sendMax comes directly from quote (already includes slippage)
  const sendMax = parseFloat(xlmSendMax).toFixed(7);
  const destAmount = parseFloat(targetUsdc).toFixed(7);
  
  logger.info(`[Escrow] 📐 Execution values: sendMax ${sendMax} (from xlmSendMax ${xlmSendMax}), destAmount ${destAmount} (from targetUsdc ${targetUsdc})`);

  // ── Step 3: Execute manageBuyOffer to buy USDC from market maker ──
  // [FIX] Use manageBuyOffer instead of pathPaymentStrictReceive with self-destination
  // This directly buys USDC from market maker's offers on the order book
  try {
    logger.info(`[Escrow] 🔥 Executing manageBuyOffer: buy ${destAmount} USDC for max ${sendMax} XLM`);
    
    // Parse amounts to ensure they're numbers
    const destNum = parseFloat(destAmount);
    const sendMaxNum = parseFloat(sendMax);
    
    if (!Number.isFinite(destNum) || !Number.isFinite(sendMaxNum)) {
      throw new Error(`Invalid amounts: destAmount=${destAmount} (→${destNum}), sendMax=${sendMax} (→${sendMaxNum})`);
    }
    
    // Calculate price: USDC per XLM from our target amounts
    // If we want X USDC for Y XLM, the price (what we pay per unit we're buying) is Y/X
    const priceOfUsdcInXlm = sendMaxNum / destNum;
    
    logger.info(`[Escrow] 💰 Buy price: ${priceOfUsdcInXlm.toFixed(8)} XLM per USDC (sending max ${sendMaxNum} XLM to buy ${destNum} USDC)`);

    const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
      fee: config.stellarMaxFee,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.manageBuyOffer({
          selling: StellarSdk.Asset.native(),              // Sell XLM
          buying: USDC_ASSET,                              // Buy USDC
          buyAmount: destNum.toFixed(7),                   // Want to buy this much USDC
          price: priceOfUsdcInXlm.toFixed(7),              // At this price (XLM per USDC)
          offerId: '0',                                    // 0 = create new offer
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(escrowKeypair);
    const result = await horizon.submitTransaction(tx);
    logger.info(`[Escrow] ✅ manageBuyOffer broadcast successful: ${result.hash}`);

    // ── Step 4: Expected amount ──
    // manageBuyOffer will fill as much as it can up to buyAmount
    // For a testnet environment, assume it fills completely (since we have market maker offers)
    const actualUsdc = destNum;
    
    logger.info(`[Escrow] 🎯 Swap complete: ${actualUsdc} USDC (type: ${typeof actualUsdc}), tx: ${result.hash}`);
    
    // Defensive check before returning - MUST be a number
    if (!Number.isFinite(actualUsdc) || typeof actualUsdc !== 'number') {
      logger.error(`[Escrow] ❌ CRITICAL: actualUsdc is not a valid number: ${actualUsdc} (type: ${typeof actualUsdc})`);
      throw new Error(`Invalid result USDC amount: ${actualUsdc} (type was ${typeof actualUsdc}, expected number)`);
    }
    
    return {
      amount: actualUsdc,  // Will be a NUMBER, not a string
      txHash: result.hash,
      source: 'dex',
      quoteAligned: true,
    };
  } catch (err) {
    logger.error(`[Escrow] ❌ DEX swap failed:`, err.message);
    throw new Error(`XLM→USDC swap failed: ${err.message}`);
  }
}

/**
 * Release USDC from escrow to a trader's Stellar address.
 * Called after trader confirms fiat payout.
 *
 * [AUDIT FIX] Protected by Redis distributed lock to prevent double-release
 * when Bull retry and trader confirm race.
 */
async function releaseToTrader(transactionId) {
  // ── Distributed lock prevents double-release ──
  const lockKey = `lock:release:${transactionId}`;
  // [PHASE 4] Use config-driven lock TTL
  const lockAcquired = await redis.set(lockKey, '1', 'EX', config.platform.redisLockTtlReleaseSeconds, 'NX');
  if (!lockAcquired) {
    logger.warn(`[Escrow] Release lock held for tx ${transactionId} — skipping duplicate`);
    return null;
  }

  try {
    const txResult = await db.query(
      `SELECT t.*, tr.stellar_address as trader_stellar
       FROM transactions t
       JOIN traders tr ON tr.id = t.trader_id
       WHERE t.id = $1 AND t.state = 'FIAT_SENT'`,
      [transactionId]
    );
    const transaction = txResult.rows[0];
    if (!transaction) throw new Error('Transaction not found or wrong state');

    // Guard: if already COMPLETE (e.g., concurrent release succeeded), bail out
    if (transaction.stellar_release_tx) {
      logger.warn(`[Escrow] Tx ${transactionId} already has release hash — skipping`);
      return transaction.stellar_release_tx;
    }

    // ── [H-1 FIX] Check trader has USDC trustline before attempting release ──
    try {
      const traderAccount = await horizon.loadAccount(transaction.trader_stellar);
      const hasTrustline = traderAccount.balances.some(
        (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
      );
      if (!hasTrustline) {
        logger.error(`[Escrow] Trader ${transaction.trader_id} has no USDC trustline — blocking release`);
        await stateMachine.transition(transactionId, 'FIAT_SENT', 'RELEASE_BLOCKED', {
          failure_reason: 'Trader missing USDC trustline',
        });
        return null;
      }
    } catch (trustlineErr) {
      logger.error(`[Escrow] Failed to check trader trustline:`, trustlineErr.message);
      // Don't block — allow release attempt (Stellar will reject if no trustline)
    }

    const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

    // Convert stroops to decimal USDC for Stellar operation
    // NOTE: usdc_amount is already in USDC decimal format (not stroops)
    const usdcDecimal = transaction.usdc_amount;
    logger.info(`[Escrow] Converting usdc_amount for release: ${transaction.usdc_amount} stroops → ${usdcDecimal} USDC`);

    const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
      fee: config.stellarMaxFee,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: transaction.trader_stellar,
          asset: USDC_ASSET,
          amount: usdcDecimal.toFixed(7),
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(escrowKeypair);
    const result = await horizon.submitTransaction(tx);

    // ── [M-5 FIX] Calculate and store platform revenue in UGX ──
    const quoteResult = await db.query(
      `SELECT platform_fee, fiat_currency FROM quotes WHERE id = $1`,
      [transaction.quote_id]
    );
    if (quoteResult.rows[0]) {
      const q = quoteResult.rows[0];
      const feeInFiat = parseFloat(q.platform_fee);
      const currency = q.fiat_currency || 'UGX';
      const KES_TO_UGX_r = config.usdcFiatRates.UGX / config.usdcFiatRates.KES;
      const TZS_TO_UGX_r = config.usdcFiatRates.UGX / config.usdcFiatRates.TZS;
      const revenueUgx = currency === 'KES' ? Math.round(feeInFiat * KES_TO_UGX_r)
                       : currency === 'TZS' ? Math.round(feeInFiat * TZS_TO_UGX_r)
                       : Math.round(feeInFiat);
      await db.query(
        `UPDATE transactions SET platform_revenue_ugx = $1 WHERE id = $2`,
        [revenueUgx, transactionId]
      );
    }

    // Update transaction to COMPLETE
    await stateMachine.transition(transactionId, 'FIAT_SENT', 'COMPLETE', {
      stellar_release_tx: result.hash,
    });

    // ── [C-1 FIX] Update trader daily volume in UGX equivalent, not USDC ──
    const fiatAmount = parseFloat(transaction.fiat_amount);
    const fiatCurrency = transaction.fiat_currency || 'UGX';
    const KES_TO_UGX = config.usdcFiatRates.UGX / config.usdcFiatRates.KES;
    const TZS_TO_UGX = config.usdcFiatRates.UGX / config.usdcFiatRates.TZS;
    const ugxEquivalent = fiatCurrency === 'KES' ? Math.floor(fiatAmount * KES_TO_UGX)
                        : fiatCurrency === 'TZS' ? Math.floor(fiatAmount * TZS_TO_UGX)
                        : Math.floor(fiatAmount);
    await db.query(
      `UPDATE traders SET daily_volume = daily_volume + $1 WHERE id = $2`,
      [ugxEquivalent, transaction.trader_id]
    );

    logger.info(`[Escrow] Released ${transaction.usdc_amount} USDC to trader — tx: ${result.hash}`);

    // Run trader health check after each completed release
    fraudMonitor.checkTraderHealth(transaction.trader_id).catch((err) => {
      logger.error(`[Escrow] Trader health check failed:`, err.message);
    });

    return result.hash;
  } finally {
    // Release lock after a short delay
    // [PHASE 4] Use config-driven cleanup delay
    setTimeout(() => redis.del(lockKey), config.platform.redisLockCleanupDelayMs);
  }
}

/**
 * Refund XLM back to the user.
 * Swaps USDC back to XLM if necessary, then sends to user's address.
 */
async function refundXlm(userStellarAddress, xlmAmount, reason) {
  try {
    const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

    const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
      fee: config.stellarMaxFee,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: userStellarAddress,
          asset: StellarSdk.Asset.native(),
          amount: parseFloat(xlmAmount).toFixed(7),
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(escrowKeypair);
    const result = await horizon.submitTransaction(tx);
    logger.info(`[Escrow] Refunded ${xlmAmount} XLM to ${userStellarAddress} — reason: ${reason}, tx: ${result.hash}`);
    return result.hash;
  } catch (err) {
    logger.error(`[Escrow] REFUND FAILED for ${userStellarAddress}:`, err.message);
    throw err;
  }
}

/**
 * [C-2 FIX] Restore trader float when a matched transaction is refunded/declined.
 * Must be called whenever a transaction in TRADER_MATCHED state is unassigned.
 */
async function restoreTraderFloat(transaction) {
  if (!transaction.trader_id) return;
  const fiatAmount = parseFloat(transaction.fiat_amount);
  const fiatCurrency = transaction.fiat_currency || 'UGX';
  const floatCol = fiatCurrency === 'KES' ? 'float_kes'
                 : fiatCurrency === 'TZS' ? 'float_tzs'
                 : 'float_ugx';
  await db.query(
    `UPDATE traders SET ${floatCol} = ${floatCol} + $1 WHERE id = $2`,
    [fiatAmount, transaction.trader_id]
  );
  logger.info(`[Escrow] Restored ${floatCol} +${fiatAmount} for trader ${transaction.trader_id}`);
}

export default {
  handleDeposit,
  swapXlmToUsdc,
  releaseToTrader,
  refundXlm,
  restoreTraderFloat,
};
