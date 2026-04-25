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
 * [REMOVED] tryMarketMakerFill used manageBuyOffer signed by the escrow account,
 * which risked partial fills + leaving a resting offer on the escrow's books.
 * The escrow now buys USDC exclusively via pathPaymentStrictReceive (atomic),
 * which naturally crosses the market maker's resting sell offers without
 * making the escrow itself a maker. See swapXlmToUsdc.
 */

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
  logger.info(`[Escrow] 🔄 SWAP START (pathPaymentStrictReceive): xlmAmount=${xlmAmount}`);
  logger.info(`[Escrow] Quote: id=${quote.id}, source=${quote.quote_source}, path_xlm_needed=${quote.path_xlm_needed}, path_usdc_received=${quote.path_usdc_received}`);

  // ── Architectural guard: refuse to execute against fake/legacy quotes ──
  // Path-payment swaps require Horizon-discovered, executable path data.
  // If the quote was synthesised from a legacy rate fallback, fail fast so
  // the caller's refund-on-error path triggers and the user is made whole.
  if (quote.quote_source !== 'horizon-path') {
    throw new Error(
      `Refusing to swap against non-executable quote (quote_source='${quote.quote_source}'). ` +
      `Path-payment swap requires a Horizon-discovered path.`
    );
  }

  const targetUsdc = Number(quote.path_usdc_received);
  const xlmSendMax = Number(quote.path_xlm_needed);

  if (!Number.isFinite(targetUsdc) || targetUsdc <= 0 ||
      !Number.isFinite(xlmSendMax) || xlmSendMax <= 0) {
    throw new Error(
      `Refusing to swap: quote missing executable path data ` +
      `(path_xlm_needed=${quote.path_xlm_needed}, path_usdc_received=${quote.path_usdc_received})`
    );
  }

  // ── sendMax / destAmount come straight from the quote ──
  // Slippage is already baked in once at quote time (config.platform.quoteSlippagePercent).
  // DO NOT multiply by slippage again here.
  const sendMax = xlmSendMax.toFixed(7);
  const destAmount = targetUsdc.toFixed(7);

  logger.info(`[Escrow] 📐 Path payment plan: sendMax=${sendMax} XLM, destAmount=${destAmount} USDC, destination=ESCROW`);

  const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

  try {
    const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
      fee: config.stellarMaxFee,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.pathPaymentStrictReceive({
          sendAsset: StellarSdk.Asset.native(),               // sending XLM
          sendMax,                                            // upper bound on XLM spent
          destination: config.stellar.escrowPublicKey,        // same-account swap (atomic)
          destAsset: USDC_ASSET,                              // receive USDC (testnet issuer)
          destAmount,                                         // EXACT USDC required
          path: [],                                           // direct XLM↔USDC orderbook
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(escrowKeypair);
    const result = await horizon.submitTransaction(tx);
    logger.info(`[Escrow] ✅ pathPaymentStrictReceive successful: ${result.hash}`);

    // ── Atomic guarantee from the operation ──
    // Stellar guarantees the destination received EXACTLY destAmount or the
    // entire transaction failed. So actualUsdc === targetUsdc by definition.
    const actualUsdc = targetUsdc;

    logger.info(`[Escrow] 🎯 Swap complete: ${actualUsdc} USDC, tx: ${result.hash}`);

    return {
      amount: actualUsdc,
      txHash: result.hash,
      source: 'path-payment-strict-receive',
      quoteAligned: true,
    };
  } catch (err) {
    // Surface Stellar result codes for diagnosis (e.g. op_too_few_offers, op_under_dest_min)
    const codes = err?.response?.data?.extras?.result_codes;
    if (codes) {
      logger.error(`[Escrow] ❌ Path payment failed with Stellar codes:`, codes);
    } else {
      logger.error(`[Escrow] ❌ Path payment failed:`, err.message);
    }
    throw new Error(`XLM→USDC path payment failed: ${err.message}`);
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
  // [BIGINT FIX] float_{currency} columns are bigint — round to whole units
  // before adding. Quote-engine math can produce fractional fiat (e.g. 192.61).
  const fiatAmount = Math.round(parseFloat(transaction.fiat_amount));
  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) {
    logger.warn(`[Escrow] restoreTraderFloat: skipping non-positive amount ${transaction.fiat_amount}`);
    return;
  }
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
