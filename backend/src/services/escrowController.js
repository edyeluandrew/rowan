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
import payoutSettingsService from './payoutSettingsService.js';
import fraudMonitor from './fraudMonitor.js';
import stateMachine from './transactionStateMachine.js';
import auditLogService from './auditLogService.js';
import notificationService from './notificationService.js';
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
      logger.warn(`[Escrow] Quote ${quote.id} already used — checking if transaction exists`);
      
      // Check if transaction already exists for this quote (idempotent retry)
      const existingTx = await db.query(
        `SELECT id, state FROM transactions WHERE quote_id = $1`,
        [quote.id]
      );
      if (existingTx.rows.length > 0) {
        logger.info(`[Escrow] ✅ IDEMPOTENT: Transaction already created for quote ${quote.id}: ${existingTx.rows[0].id} (state: ${existingTx.rows[0].state})`);
        await redis.del(lockKey);
        return;
      }
      
      logger.error(`[Escrow] ❌ CRITICAL: Quote marked used but no transaction found! quote=${quote.id}`);
      await redis.del(lockKey);
      return;
    }

    const txResult = await client.query(
      `INSERT INTO transactions
         (quote_id, user_id, xlm_amount, fiat_amount, fiat_currency,
          network, phone_hash, state, stellar_deposit_tx, locked_rate, escrow_locked_at,
          payout_phone, payout_name, preferred_payout_setting_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ESCROW_LOCKED',$8,$9,NOW(),$10,$11,$12)
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
        quote.payout_phone,             // Payout phone from quote
        quote.payout_name,              // Payout name from quote
        quote.preferred_payout_setting_id || null,
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
    // Check for unique constraint violation on quote_id
    if (err.code === '23505' && err.constraint?.includes('quote_id')) {
      logger.warn(`[Escrow] ⚠️  UNIQUE constraint violation on quote_id — transaction already exists (idempotent)`);
      // This is idempotent — the transaction was already created by a previous call
      const existingTx = await db.query(
        `SELECT id, state FROM transactions WHERE quote_id = $1`,
        [quote.id]
      );
      if (existingTx.rows.length > 0) {
        logger.info(`[Escrow] ✅ IDEMPOTENT: Found existing transaction: ${existingTx.rows[0].id}`);
        transaction = existingTx.rows[0];
      } else {
        logger.error(`[Escrow] ❌ Unique constraint error but no transaction found!`);
        await redis.del(lockKey);
        throw err;
      }
    } else {
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
    }
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

    // 6. Match trader while still ESCROW_LOCKED — matchTrader atomically transitions
    //    to TRADER_MATCHED only when a trader + payout setting are assigned.
    //    Do NOT pre-transition with trader_id=null (causes UI stall / rematch loops).
    logger.info(`[Escrow] Matching trader for tx ${transaction.id} (state: ESCROW_LOCKED)`);
    try {
      await matchingEngine.matchTrader(transaction.id);
      logger.info(`[Escrow] matchTrader finished for tx ${transaction.id}`);
    } catch (matchingErr) {
      logger.error(`[Escrow] matchTrader error for tx ${transaction.id}: ${matchingErr?.message}`);
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
  logger.info(`[Escrow] 🔄 SWAP START: pathPaymentStrictReceive, xlmAmount=${xlmAmount}`);
  logger.info(`[Escrow] Quote: id=${quote.id}, source=${quote.quote_source}, path_xlm_needed=${quote.path_xlm_needed}, path_usdc_received=${quote.path_usdc_received}`);

  // ── Architectural guard: accept both horizon-path AND legacy-fallback quotes ──
  // [PHASE 5 RESOLUTION] Horizon's path API was returning 0 records on testnet,
  // but direct pathPaymentStrictReceive execution works perfectly (confirmed via test).
  // Stellar's built-in pathfinding (path: []) handles legacy-fallback rates just fine.
  // Therefore, we accept both quote sources and let the path payment execute naturally.
  // Only reject quotes that are completely invalid (missing path data).
  if (!quote.path_xlm_needed || !quote.path_usdc_received) {
    throw new Error(
      `Refusing to swap: quote missing executable path data ` +
      `(path_xlm_needed=${quote.path_xlm_needed}, path_usdc_received=${quote.path_usdc_received})`
    );
  }

  const targetUsdc = Number(quote.path_usdc_received);
  const xlmSendMax = Number(quote.path_xlm_needed);

  if (!Number.isFinite(targetUsdc) || targetUsdc <= 0 ||
      !Number.isFinite(xlmSendMax) || xlmSendMax <= 0) {
    throw new Error(
      `Invalid quote amounts: xlmSendMax=${xlmSendMax}, targetUsdc=${targetUsdc}`
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
 * Refund post-swap escrow USDC to the user as native XLM via path payment.
 * Casual wallets need no USDC trustline — destination receives XLM only.
 */
async function swapUsdcToXlmForRefund(userStellarAddress, usdcAmount, xlmAmount, memoText) {
  const usdcDecimal = Number(usdcAmount);
  const xlmDecimal = Number(xlmAmount);
  if (!Number.isFinite(usdcDecimal) || usdcDecimal <= 0) {
    throw new Error(`Invalid USDC amount: ${usdcAmount}`);
  }
  if (!Number.isFinite(xlmDecimal) || xlmDecimal <= 0) {
    throw new Error(`Invalid XLM amount: ${xlmAmount}`);
  }

  const sendMax = (usdcDecimal * 1.02).toFixed(7);
  const destAmount = xlmDecimal.toFixed(7);

  const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);
  const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
    fee: config.stellarMaxFee,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: USDC_ASSET,
        sendMax,
        destination: userStellarAddress,
        destAsset: StellarSdk.Asset.native(),
        destAmount,
        path: [],
      })
    )
    .addMemo(StellarSdk.Memo.text(memoText))
    .setTimeout(30)
    .build();

  tx.sign(escrowKeypair);
  const result = await horizon.submitTransaction(tx);
  logger.info(
    `[Escrow] USDC→XLM orphan refund: ${destAmount} XLM to ${userStellarAddress} — tx: ${result.hash}`
  );
  return result.hash;
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
       WHERE t.id = $1 AND t.state IN ('USER_CONFIRMATION_PENDING', 'DISPUTE_RELEASE_PENDING', 'RELEASE_BLOCKED')`,
      [transactionId]
    );
    const transaction = txResult.rows[0];
    if (!transaction) throw new Error('Transaction not found or wrong state (expected USER_CONFIRMATION_PENDING or DISPUTE_RELEASE_PENDING)');

    // ── Validate trader stellar address before attempting release ──
    if (!transaction.trader_stellar) {
      logger.error(`[Escrow] Trader stellar address is NULL for tx ${transactionId}, trader_id=${transaction.trader_id}`);
      // Mark transaction as stuck — needs manual intervention
      await db.query(
        `UPDATE transactions SET failure_reason = 'Trader missing stellar address' WHERE id = $1`,
        [transactionId]
      );
      throw new Error(`Trader ${transaction.trader_id} has no stellar address configured`);
    }

    // Guard: if already COMPLETE (e.g., concurrent release succeeded), bail out
    if (transaction.stellar_release_tx) {
      logger.warn(`[Escrow] Tx ${transactionId} already has release hash — skipping`);
      return transaction.stellar_release_tx;
    }

    // ── [H-1 FIX] Check trader has USDC trustline before attempting release ──
    try {
      const traderAccount = await horizon.loadAccount(transaction.trader_stellar);
      
      if (!traderAccount) {
        logger.error(`[Escrow] Horizon returned null for trader account ${transaction.trader_stellar}`);
        throw new Error('Failed to load trader account from Horizon');
      }
      
      if (!traderAccount.balances || !Array.isArray(traderAccount.balances)) {
        logger.error(`[Escrow] Trader account has invalid balances structure:`, traderAccount.balances);
        throw new Error('Invalid trader account structure from Horizon');
      }
      
      const hasTrustline = traderAccount.balances.some(
        (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
      );
      if (!hasTrustline) {
        logger.error(`[Escrow] Trader ${transaction.trader_id} has no USDC trustline — blocking release`);
        if (transaction.state !== 'RELEASE_BLOCKED') {
          await stateMachine.transition(transactionId, transaction.state, 'RELEASE_BLOCKED', {
            failure_reason: 'Trader missing USDC trustline',
          });
          await auditLogService.log({
            actor_role: 'system',
            action: 'escrow_release_blocked',
            resource_type: 'transaction',
            resource_id: transactionId,
            new_value: { state: 'RELEASE_BLOCKED' },
            metadata: {
              trader_id: transaction.trader_id,
              reason: 'Trader missing USDC trustline',
              from_state: transaction.state,
            },
          });
        } else {
          await db.query(
            `UPDATE transactions SET failure_reason = $1, updated_at = NOW() WHERE id = $2`,
            ['Trader missing USDC trustline', transactionId]
          );
        }
        return null;
      }
    } catch (trustlineErr) {
      logger.error(`[Escrow] Failed to check trader trustline:`, trustlineErr.message);
      // Block release if we can't verify trustline
      // Better to block than to attempt release that will fail
      throw new Error(`Cannot verify trader trustline: ${trustlineErr.message}`);
      // Don't block — allow release attempt (Stellar will reject if no trustline)
    }

    const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

    // Convert stroops to decimal USDC for Stellar operation
    // NOTE: usdc_amount is already in USDC decimal format (not stroops)
    // Ensure it's a number (might come from DB as string)
    const usdcDecimal = Number(transaction.usdc_amount);
    if (!Number.isFinite(usdcDecimal) || usdcDecimal <= 0) {
      throw new Error(`Invalid USDC amount for release: ${transaction.usdc_amount}`);
    }
    logger.info(`[Escrow] Converting usdc_amount for release: ${transaction.usdc_amount} → ${usdcDecimal} USDC`);

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

    // Update transaction to COMPLETE (from either USER_CONFIRMATION_PENDING or DISPUTE_RELEASE_PENDING)
    const appealExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await stateMachine.transition(transactionId, transaction.state, 'COMPLETE', {
      stellar_release_tx: result.hash,
      appeal_expires_at: appealExpiresAt,
    });

    // ── [PHASE 2A] Finalize canonical float EXACTLY ONCE ──
    // Decrements BOTH available_float and reserved_float on the payout setting,
    // in the setting's own currency. Idempotent via transactions.float_settled,
    // so normal-complete and trader-win-dispute both settle at most once. Legacy
    // transactions with NULL payout_setting_id are logged and safely skipped.
    try {
      await payoutSettingsService.finalizeFloatForTransaction(
        transactionId,
        transaction.payout_setting_id,
        transaction.fiat_amount
      );
    } catch (finalizeErr) {
      // USDC is already released on-chain; do NOT fail here (that would risk a
      // double-release retry). Surface loudly for ops; float can be reconciled.
      logger.error(`[Escrow] Float finalize FAILED for tx ${transactionId} (USDC already released): ${finalizeErr.message}`);
    }

    // ── [PHASE 2A / B3] Audit the money-moving release ──
    await auditLogService.log({
      actor_role: 'system',
      action: 'escrow_release',
      resource_type: 'transaction',
      resource_id: transactionId,
      new_value: { state: 'COMPLETE', stellar_release_tx: result.hash },
      metadata: {
        trader_id: transaction.trader_id,
        payout_setting_id: transaction.payout_setting_id,
        usdc_amount: transaction.usdc_amount,
        fiat_amount: transaction.fiat_amount,
        fiat_currency: transaction.fiat_currency,
        from_state: transaction.state,
      },
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
 * Release USDC from escrow to the wallet user (BUY orders).
 */
async function releaseToUser(transactionId) {
  const lockKey = `lock:release-user:${transactionId}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', config.platform.redisLockTtlReleaseSeconds, 'NX');
  if (!lockAcquired) {
    logger.warn(`[Escrow] User release lock held for tx ${transactionId}`);
    return null;
  }

  try {
    const txResult = await db.query(
      `SELECT t.*, u.stellar_address AS user_stellar
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = $1 AND t.order_side = 'BUY'
         AND t.state IN ('USER_CONFIRMATION_PENDING', 'DISPUTE_RELEASE_PENDING', 'RELEASE_BLOCKED')`,
      [transactionId]
    );
    const transaction = txResult.rows[0];
    if (!transaction) throw new Error('Buy transaction not found or wrong state');

    if (!transaction.user_stellar) {
      throw new Error(`User ${transaction.user_id} has no stellar address`);
    }

    if (transaction.stellar_release_tx) {
      return transaction.stellar_release_tx;
    }

    const userAccount = await horizon.loadAccount(transaction.user_stellar);
    const hasTrustline = userAccount.balances.some(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
    if (!hasTrustline) {
      if (transaction.state !== 'RELEASE_BLOCKED') {
        await stateMachine.transition(transactionId, transaction.state, 'RELEASE_BLOCKED', {
          failure_reason: 'User missing USDC trustline',
        });
      }
      return null;
    }

    const usdcDecimal = Number(transaction.usdc_amount);
    if (!Number.isFinite(usdcDecimal) || usdcDecimal <= 0) {
      throw new Error(`Invalid USDC amount: ${transaction.usdc_amount}`);
    }

    const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);
    const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
      fee: config.stellarMaxFee,
      networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: transaction.user_stellar,
          asset: USDC_ASSET,
          amount: usdcDecimal.toFixed(7),
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(escrowKeypair);
    const result = await horizon.submitTransaction(tx);

    const appealExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await stateMachine.transition(transactionId, transaction.state, 'COMPLETE', {
      stellar_release_tx: result.hash,
      appeal_expires_at: appealExpiresAt,
    });

    try {
      await payoutSettingsService.finalizeUsdcFloatForTransaction(
        transactionId,
        transaction.payout_setting_id,
        usdcDecimal
      );
    } catch (finalizeErr) {
      logger.error(`[Escrow] USDC float finalize failed for buy tx ${transactionId}: ${finalizeErr.message}`);
    }

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

    notificationService.notifyUser(transaction.user_id, 'buy_complete', {
      transactionId,
      usdcAmount: transaction.usdc_amount,
      stellarReleaseTx: result.hash,
    }).catch(() => {});

    logger.info(`[Escrow] Released ${usdcDecimal} USDC to user for buy tx ${transactionId}`);
    return result.hash;
  } finally {
    setTimeout(() => redis.del(lockKey), config.platform.redisLockCleanupDelayMs);
  }
}

/**
 * Trader locks USDC in escrow for a BUY order (Horizon watcher or manual verify).
 */
async function handleTraderUsdcDeposit({ memo, amount, sourceAccount, txHash }) {
  logger.info(`[Escrow] Trader USDC deposit — memo: ${memo}, amount: ${amount}, from: ${sourceAccount}`);

  const lockKey = `lock:usdc-deposit:${memo}`;
  const lockAcquired = await redis.set(lockKey, txHash, 'EX', config.platform.redisLockTtlDepositSeconds, 'NX');
  if (!lockAcquired) return;

  const quoteResult = await db.query(
    `SELECT q.*, t.id AS tx_id, t.state AS tx_state, t.trader_id, t.user_id, t.usdc_amount,
            t.fiat_amount, t.fiat_currency, t.network AS tx_network, t.matched_at,
            tr.stellar_address AS trader_stellar
     FROM quotes q
     JOIN transactions t ON t.quote_id = q.id
     JOIN traders tr ON tr.id = t.trader_id
     WHERE q.memo = $1 AND q.order_side = 'BUY' AND q.is_used = TRUE`,
    [memo]
  );
  const row = quoteResult.rows[0];
  if (!row) {
    logger.warn(`[Escrow] No buy order for USDC memo ${memo}`);
    await redis.del(lockKey);
    return;
  }

  if (row.tx_state !== 'TRADER_MATCHED' || !row.matched_at) {
    logger.warn(`[Escrow] Buy tx ${row.tx_id} not ready for USDC lock (state=${row.tx_state})`);
    await redis.del(lockKey);
    return;
  }

  if (sourceAccount !== row.trader_stellar) {
    logger.warn(`[Escrow] USDC deposit from wrong account: ${sourceAccount} vs ${row.trader_stellar}`);
    await redis.del(lockKey);
    return;
  }

  const expectedUsdc = Number(row.usdc_amount);
  const receivedUsdc = Number(amount);
  const tolerance = 0.0000001;
  if (Math.abs(receivedUsdc - expectedUsdc) > tolerance) {
    logger.warn(`[Escrow] USDC amount mismatch: expected ${expectedUsdc}, got ${receivedUsdc}`);
    await redis.del(lockKey);
    return;
  }

  const transitioned = await stateMachine.transition(row.tx_id, 'TRADER_MATCHED', 'ESCROW_LOCKED', {
    stellar_deposit_tx: txHash,
    usdc_amount: receivedUsdc,
  });

  if (!transitioned) {
    await redis.del(lockKey);
    return;
  }

  const paymentExpiresAt = new Date(Date.now() + config.platform.paymentWindowSeconds * 1000);
  await db.query(
    `UPDATE transactions SET payment_expires_at = $1 WHERE id = $2`,
    [paymentExpiresAt, row.tx_id]
  );

  notificationService.notifyUser(row.user_id, 'usdc_locked', {
    transactionId: row.tx_id,
    message: 'Trader locked USDC. Send mobile money now.',
    paymentExpiresAt: paymentExpiresAt.toISOString(),
  }).catch(() => {});

  const { getVerifiedTraderMomo, buildBuyPaymentDetailsPayload } = await import('./traderMomoService.js');
  const traderMomo = await getVerifiedTraderMomo(row.trader_id, row.tx_network || row.network);
  const chatService = (await import('./chatService.js')).default;
  chatService.sendPaymentDetailsMessage(
    row.tx_id,
    buildBuyPaymentDetailsPayload(
      {
        id: row.tx_id,
        network: row.tx_network || row.network,
        fiat_amount: row.fiat_amount,
        fiat_currency: row.fiat_currency,
      },
      traderMomo
    )
  ).catch(() => {});

  logger.info(`[Escrow] Buy tx ${row.tx_id} USDC locked — user may pay MoMo`);
  await redis.del(lockKey);
}

/**
 * Refund native XLM from escrow to the user (pre-swap path only).
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
 * [PHASE 2B] Refund escrowed USDC back to the wallet user (user-win dispute).
 *
 * Product decision: refund the escrowed USDC to the user's Stellar address.
 * We do NOT swap USDC back to XLM in this phase, and we NEVER release to the
 * trader on a user-win.
 *
 * Safety / idempotency:
 *   - Redis distributed lock prevents concurrent double-refund.
 *   - Hard guards (throw 409): tx already released to trader (stellar_release_tx),
 *     COMPLETE, or not in DISPUTE_REFUND_PENDING.
 *   - Soft idempotency (no throw): already REFUNDED / stellar_refund_tx present →
 *     returns { status: 'already_refunded' }.
 *   - Blocked (no throw): missing trustline / account / escrow balance → keeps the
 *     tx in DISPUTE_REFUND_PENDING, records refund_error, returns { status:'blocked' }.
 *   - Failed submission (no throw): keeps DISPUTE_REFUND_PENDING, records error,
 *     returns { status:'failed' } so an admin can retry.
 *
 * Float is NOT touched here — the reserved float was already released during
 * user-win resolution (Phase 2A) and is idempotent via transactions.float_settled.
 *
 * @param {string} transactionId
 * @param {object} [opts] - { adminId?: string, retry?: boolean }
 * @returns {Promise<{status:string, refundHash?:string, code?:string, error?:string, message?:string}>}
 */
async function refundToUser(transactionId, { adminId = null, retry = false } = {}) {
  const lockKey = `lock:refund:${transactionId}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', config.platform.redisLockTtlReleaseSeconds, 'NX');
  if (!lockAcquired) {
    logger.warn(`[Refund] Refund lock held for tx ${transactionId} — skipping duplicate`);
    return { status: 'locked', message: 'Refund already in progress' };
  }

  try {
    const txResult = await db.query(
      `SELECT t.*, u.stellar_address AS user_stellar
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.id = $1`,
      [transactionId]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }

    // ── Hard safety guards (must NOT refund) ──
    if (tx.stellar_release_tx) {
      const err = new Error('Cannot refund: USDC was already released to the trader for this transaction.');
      err.statusCode = 409;
      throw err;
    }
    if (tx.state === 'COMPLETE') {
      const err = new Error('Cannot refund a COMPLETE transaction.');
      err.statusCode = 409;
      throw err;
    }

    // ── Soft idempotency (already refunded) ──
    if (tx.stellar_refund_tx || tx.state === 'REFUNDED') {
      logger.info(`[Refund] Tx ${transactionId} already refunded (${tx.stellar_refund_tx || 'state REFUNDED'}) — no-op`);
      return { status: 'already_refunded', refundHash: tx.stellar_refund_tx || null };
    }

    // ── State guard: only a user-win pending refund is refundable ──
    if (tx.state !== 'DISPUTE_REFUND_PENDING') {
      const err = new Error(`Cannot refund: transaction is in ${tx.state}, expected DISPUTE_REFUND_PENDING.`);
      err.statusCode = 409;
      throw err;
    }

    const usdcDecimal = Number(tx.usdc_amount);
    if (!Number.isFinite(usdcDecimal) || usdcDecimal <= 0) {
      const code = 'INVALID_USDC_AMOUNT';
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [code, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system',
        admin_id: adminId,
        action: 'refund_failed',
        resource_type: 'transaction',
        resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code, usdc_amount: tx.usdc_amount },
      });
      return { status: 'failed', code, message: `Invalid USDC amount for refund: ${tx.usdc_amount}` };
    }

    if (!tx.user_stellar) {
      const code = 'USER_MISSING_STELLAR_ADDRESS';
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [code, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system',
        admin_id: adminId,
        action: 'refund_blocked_missing_trustline',
        resource_type: 'transaction',
        resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code },
      });
      return { status: 'blocked', code, message: 'User has no Stellar address on file.' };
    }

    // ── Audit: refund started / retried ──
    await auditLogService.log({
      actor_role: adminId ? 'admin' : 'system',
      admin_id: adminId,
      action: retry ? 'refund_retry' : 'refund_started',
      resource_type: 'transaction',
      resource_id: transactionId,
      metadata: {
        user_id: tx.user_id,
        trader_id: tx.trader_id,
        dispute_id: tx.dispute_id,
        amount_usdc: usdcDecimal,
        user_stellar: tx.user_stellar,
      },
    });

    // ── 1. Verify escrow holds enough USDC ──
    let escrowAccount;
    try {
      escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);
    } catch (e) {
      const code = 'ESCROW_ACCOUNT_LOAD_FAILED';
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [code, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system', admin_id: adminId,
        action: 'refund_failed', resource_type: 'transaction', resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code, error: e.message },
      });
      return { status: 'failed', code, message: `Could not load escrow account: ${e.message}` };
    }

    const escrowUsdcBal = escrowAccount.balances.find(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
    const escrowUsdc = escrowUsdcBal ? Number(escrowUsdcBal.balance) : 0;
    if (escrowUsdc + 1e-7 < usdcDecimal) {
      const code = 'INSUFFICIENT_ESCROW_BALANCE';
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [code, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system', admin_id: adminId,
        action: 'refund_failed', resource_type: 'transaction', resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code, escrow_usdc: escrowUsdc, needed_usdc: usdcDecimal },
      });
      logger.error(`[Refund] Tx ${transactionId} blocked: escrow holds ${escrowUsdc} USDC, needs ${usdcDecimal}`);
      return { status: 'failed', code, message: `Escrow holds ${escrowUsdc} USDC but ${usdcDecimal} is required.` };
    }

    // ── 2. Verify user account exists + has a USDC trustline ──
    let userAccount;
    try {
      userAccount = await horizon.loadAccount(tx.user_stellar);
    } catch (e) {
      // 404 = account not funded/created on this network
      const notFound = e?.response?.status === 404 || /not found/i.test(e.message);
      const code = notFound ? 'USER_ACCOUNT_NOT_FOUND' : 'USER_ACCOUNT_LOAD_FAILED';
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [code, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system', admin_id: adminId,
        action: 'refund_blocked_missing_trustline', resource_type: 'transaction', resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code, user_stellar: tx.user_stellar },
      });
      logger.warn(`[Refund] Tx ${transactionId} blocked: ${code} for ${tx.user_stellar}`);
      return { status: 'blocked', code, message: notFound ? 'User wallet account does not exist on Stellar yet.' : `Could not load user account: ${e.message}` };
    }

    const hasTrustline = userAccount.balances.some(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
    if (!hasTrustline) {
      const code = 'USER_MISSING_USDC_TRUSTLINE';
      // Keep tx in DISPUTE_REFUND_PENDING — do NOT mark REFUNDED.
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [code, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system', admin_id: adminId,
        action: 'refund_blocked_missing_trustline', resource_type: 'transaction', resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code, amount_usdc: usdcDecimal, user_stellar: tx.user_stellar },
      });
      try {
        await notificationService.notifyUser(tx.user_id, 'refund_blocked_trustline', {
          transactionId,
          status: 'refund_waiting_trustline',
          message: 'Your dispute was resolved in your favour, but your wallet must add a USDC trustline before the refund can complete.',
        });
      } catch (_) { /* notification best-effort */ }
      logger.warn(`[Refund] Tx ${transactionId} blocked: user ${tx.user_stellar} has no USDC trustline`);
      return { status: 'blocked', code, message: 'User wallet has no USDC trustline. Refund will complete after the user adds one and an admin retries.' };
    }

    // ── 3. Submit USDC payment escrow → user ──
    let result;
    try {
      const paymentTx = new StellarSdk.TransactionBuilder(escrowAccount, {
        fee: config.stellarMaxFee,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: tx.user_stellar,
            asset: USDC_ASSET,
            amount: usdcDecimal.toFixed(7),
          })
        )
        .setTimeout(30)
        .build();
      paymentTx.sign(escrowKeypair);
      result = await horizon.submitTransaction(paymentTx);
    } catch (e) {
      const codes = e?.response?.data?.extras?.result_codes;
      const code = 'REFUND_TX_FAILED';
      const detail = codes ? JSON.stringify(codes) : e.message;
      await db.query(`UPDATE transactions SET refund_error = $1 WHERE id = $2`, [`${code}: ${detail}`, transactionId]);
      await auditLogService.log({
        actor_role: adminId ? 'admin' : 'system', admin_id: adminId,
        action: 'refund_failed', resource_type: 'transaction', resource_id: transactionId,
        metadata: { user_id: tx.user_id, dispute_id: tx.dispute_id, error_code: code, amount_usdc: usdcDecimal, stellar_result: codes || null, error: e.message },
      });
      logger.error(`[Refund] Tx ${transactionId} submission FAILED: ${detail}`);
      return { status: 'failed', code, message: `On-chain refund submission failed: ${detail}` };
    }

    // ── 4. Mark REFUNDED only after a successful on-chain refund ──
    const transitioned = await stateMachine.transition(transactionId, 'DISPUTE_REFUND_PENDING', 'REFUNDED', {
      stellar_refund_tx: result.hash,
      refund_error: null,
    });
    if (!transitioned) {
      // The on-chain refund already happened. A concurrent path moved the state.
      // Persist the hash defensively and treat as success (idempotent).
      logger.warn(`[Refund] Tx ${transactionId} state guard failed after on-chain refund ${result.hash} — persisting hash defensively`);
      await db.query(
        `UPDATE transactions SET stellar_refund_tx = COALESCE(stellar_refund_tx, $1), refund_error = NULL WHERE id = $2`,
        [result.hash, transactionId]
      );
    }

    await auditLogService.log({
      actor_role: adminId ? 'admin' : 'system',
      admin_id: adminId,
      action: 'refund_succeeded',
      resource_type: 'transaction',
      resource_id: transactionId,
      new_value: { state: 'REFUNDED', stellar_refund_tx: result.hash },
      metadata: {
        user_id: tx.user_id,
        trader_id: tx.trader_id,
        dispute_id: tx.dispute_id,
        amount_usdc: usdcDecimal,
        stellar_refund_tx: result.hash,
        user_stellar: tx.user_stellar,
      },
    });

    try {
      await notificationService.notifyUser(tx.user_id, 'refund_complete', {
        transactionId,
        status: 'refunded',
        stellarRefundTx: result.hash,
        message: 'Your dispute was resolved in your favour. The escrowed USDC has been returned to your wallet.',
      });
      if (tx.trader_id) {
        await notificationService.notifyTrader(tx.trader_id, 'dispute_refund_complete', {
          transactionId,
          message: 'This dispute was resolved for the customer. The escrowed USDC was returned to the customer.',
        });
      }
    } catch (_) { /* notification best-effort */ }

    logger.info(`[Refund] Tx ${transactionId} REFUNDED ${usdcDecimal} USDC to user ${tx.user_stellar} — ${result.hash}`);
    return { status: 'refunded', refundHash: result.hash, amountUsdc: usdcDecimal };
  } finally {
    setTimeout(() => redis.del(lockKey), config.platform.redisLockCleanupDelayMs);
  }
}

/**
 * [PHASE 2H] Orphan / auto-refund handler with pre-swap vs post-swap branching.
 * Does NOT mark REFUNDED unless on-chain refund succeeds.
 */
async function refundOrphanTransaction(transactionId, reason) {
  const txResult = await db.query(
    `SELECT t.*, u.stellar_address AS user_stellar
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1`,
    [transactionId]
  );
  const tx = txResult.rows[0];
  if (!tx) throw new Error(`Transaction ${transactionId} not found`);

  if (tx.admin_recovery_tx) {
    return { status: 'skipped', reason: 'admin_recovered' };
  }
  if (tx.stellar_refund_tx || tx.state === 'REFUNDED') {
    return { status: 'skipped', reason: 'already_refunded' };
  }
  if (tx.stellar_release_tx || tx.state === 'COMPLETE') {
    return { status: 'skipped', reason: 'released_or_complete' };
  }
  if (tx.dispute_id) {
    return { status: 'skipped', reason: 'dispute_open' };
  }

  await releaseMatchFloatForTransaction(tx);

  const postSwap = !!(tx.stellar_swap_tx && Number(tx.usdc_amount) > 0);

  if (postSwap) {
    return refundOrphanPostSwap(tx, reason);
  }
  return refundOrphanPreSwap(tx, reason);
}

async function userHasUsdcTrustline(stellarAddress) {
  if (!stellarAddress) return false;
  try {
    const acct = await horizon.loadAccount(stellarAddress);
    return acct.balances.some(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
  } catch (e) {
    if (e?.response?.status === 404) return false;
    throw e;
  }
}

async function refundOrphanPostSwap(tx, reason) {
  const usdcDecimal = Number(tx.usdc_amount);
  const xlmDecimal = Number(tx.xlm_amount);
  if (!Number.isFinite(usdcDecimal) || usdcDecimal <= 0) {
    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_refund_failed',
      resource_type: 'transaction',
      resource_id: tx.id,
      metadata: { reason, code: 'INVALID_USDC_AMOUNT' },
    });
    return { status: 'failed', code: 'INVALID_USDC_AMOUNT' };
  }
  if (!Number.isFinite(xlmDecimal) || xlmDecimal <= 0) {
    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_refund_failed',
      resource_type: 'transaction',
      resource_id: tx.id,
      metadata: { reason, code: 'INVALID_XLM_AMOUNT' },
    });
    return { status: 'failed', code: 'INVALID_XLM_AMOUNT' };
  }

  const memoText = `ORPHAN-${tx.id.replace(/-/g, '').slice(0, 12)}`;

  try {
    const refundHash = await swapUsdcToXlmForRefund(
      tx.user_stellar,
      usdcDecimal,
      xlmDecimal,
      memoText
    );

    if (stateMachine.isValidTransition(tx.state, 'REFUNDED')) {
      await stateMachine.transition(tx.id, tx.state, 'REFUNDED', {
        stellar_refund_tx: refundHash,
        failure_reason: reason,
      });
    } else {
      await db.query(
        `UPDATE transactions SET stellar_refund_tx = $1, failure_reason = $2, refunded_at = NOW() WHERE id = $3`,
        [refundHash, reason, tx.id]
      );
    }

    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_refund_succeeded',
      resource_type: 'transaction',
      resource_id: tx.id,
      new_value: { state: 'REFUNDED', stellar_refund_tx: refundHash },
      metadata: { reason, usdc_amount: usdcDecimal, xlm_amount: xlmDecimal, asset: 'XLM' },
    });

    return { status: 'refunded', refundHash, asset: 'XLM' };
  } catch (err) {
    logger.error(`[Escrow] Orphan USDC→XLM refund failed for tx ${tx.id}:`, err.message);
    await db.query(
      `UPDATE transactions SET refund_error = $1 WHERE id = $2`,
      [`ORPHAN_XLM_REFUND_FAILED: ${err.message}`, tx.id]
    );
    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_refund_failed',
      resource_type: 'transaction',
      resource_id: tx.id,
      metadata: { reason, error: err.message, asset: 'XLM' },
    });
    return { status: 'failed', error: err.message };
  }
}

async function refundOrphanPreSwap(tx, reason) {
  try {
    const refundHash = await refundXlm(tx.user_stellar, tx.xlm_amount, reason);
    if (stateMachine.isValidTransition(tx.state, 'REFUNDED')) {
      await stateMachine.transition(tx.id, tx.state, 'REFUNDED', {
        stellar_refund_tx: refundHash,
        failure_reason: reason,
      });
    } else {
      await db.query(
        `UPDATE transactions SET state = 'REFUNDED', stellar_refund_tx = $1, refunded_at = NOW(), failure_reason = $2 WHERE id = $3`,
        [refundHash, reason, tx.id]
      );
    }
    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_refund_succeeded',
      resource_type: 'transaction',
      resource_id: tx.id,
      new_value: { state: 'REFUNDED', stellar_refund_tx: refundHash },
      metadata: { reason, asset: 'XLM' },
    });
    return { status: 'refunded', refundHash, asset: 'XLM' };
  } catch (err) {
    logger.error(`[Escrow] Orphan XLM refund failed for tx ${tx.id}:`, err.message);
    await auditLogService.log({
      actor_role: 'system',
      action: 'orphan_refund_failed',
      resource_type: 'transaction',
      resource_id: tx.id,
      metadata: { reason, error: err.message, asset: 'XLM' },
    });
    return { status: 'failed', error: err.message };
  }
}

/**
 * [PHASE 2H] Release canonical match reservation, or legacy trader float if pre-2A.
 */
async function releaseMatchFloatForTransaction(transaction) {
  const hadPayoutSetting = !!transaction.payout_setting_id;
  const result = await payoutSettingsService.releaseMatchReservationIfAssigned(transaction.id);
  if (!hadPayoutSetting && transaction.trader_id) {
    await restoreTraderFloat(transaction);
  }
  return result;
}

/**
 * [C-2 FIX] Restore trader float when a matched transaction is refunded/declined.
 * Legacy path only — prefer releaseMatchFloatForTransaction for Phase 2A+ txs.
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

const RELEASE_RETRY_ALLOWED_STATE = 'RELEASE_BLOCKED';

/**
 * [PHASE 2H-3B] Admin retry for normal-flow RELEASE_BLOCKED after root cause is fixed.
 * Uses releaseToTrader — never marks COMPLETE without on-chain stellar_release_tx.
 */
async function retryReleaseBlocked(transactionId, { adminId } = {}) {
  const txResult = await db.query(
    `SELECT t.*, tr.stellar_address AS trader_stellar
     FROM transactions t
     LEFT JOIN traders tr ON tr.id = t.trader_id
     WHERE t.id = $1`,
    [transactionId]
  );
  const tx = txResult.rows[0];
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }

  if (tx.state === 'COMPLETE' && tx.stellar_release_tx) {
    return {
      status: 'already_complete',
      state: 'COMPLETE',
      releaseHash: tx.stellar_release_tx,
    };
  }

  if (tx.state !== RELEASE_RETRY_ALLOWED_STATE) {
    await auditLogService.log({
      admin_id: adminId,
      actor_role: 'admin',
      actor_id: adminId,
      action: 'release_retry_wrong_state',
      resource_type: 'transaction',
      resource_id: transactionId,
      metadata: { current_state: tx.state, allowed_state: RELEASE_RETRY_ALLOWED_STATE },
    });
    const err = new Error(
      `Release retry only allowed for ${RELEASE_RETRY_ALLOWED_STATE} (current: ${tx.state})`
    );
    err.statusCode = 409;
    throw err;
  }

  if (tx.stellar_release_tx) {
    const err = new Error('Transaction already has a release hash');
    err.statusCode = 409;
    throw err;
  }
  if (tx.stellar_refund_tx) {
    const err = new Error('Transaction already refunded on-chain');
    err.statusCode = 409;
    throw err;
  }
  if (tx.admin_recovery_tx) {
    const err = new Error('Transaction was admin-recovered; release retry not allowed');
    err.statusCode = 409;
    throw err;
  }
  if (!tx.trader_id) {
    const err = new Error('Transaction has no matched trader');
    err.statusCode = 409;
    throw err;
  }
  if (!tx.trader_stellar) {
    const err = new Error('Trader has no Stellar address configured');
    err.statusCode = 409;
    throw err;
  }
  const usdcAmount = Number(tx.usdc_amount);
  if (!Number.isFinite(usdcAmount) || usdcAmount <= 0) {
    const err = new Error('Transaction has no escrowed USDC amount');
    err.statusCode = 409;
    throw err;
  }

  let hasTrustline = false;
  try {
    const traderAccount = await horizon.loadAccount(tx.trader_stellar);
    hasTrustline = traderAccount.balances.some(
      (b) => b.asset_code === USDC_ASSET.code && b.asset_issuer === USDC_ASSET.issuer
    );
  } catch (trustlineErr) {
    if (trustlineErr?.response?.status !== 404) {
      await auditLogService.log({
        admin_id: adminId,
        actor_role: 'admin',
        actor_id: adminId,
        action: 'release_retry_failed',
        resource_type: 'transaction',
        resource_id: transactionId,
        metadata: { error: trustlineErr.message },
      });
      throw trustlineErr;
    }
  }
  if (!hasTrustline) {
    await auditLogService.log({
      admin_id: adminId,
      actor_role: 'admin',
      actor_id: adminId,
      action: 'release_retry_blocked',
      resource_type: 'transaction',
      resource_id: transactionId,
      metadata: { reason: 'Trader missing USDC trustline' },
    });
    return { status: 'blocked', state: RELEASE_RETRY_ALLOWED_STATE };
  }

  await auditLogService.log({
    admin_id: adminId,
    actor_role: 'admin',
    actor_id: adminId,
    action: 'release_retry_started',
    resource_type: 'transaction',
    resource_id: transactionId,
    metadata: { trader_id: tx.trader_id, usdc_amount: usdcAmount },
  });

  try {
    const releaseHash = await releaseToTrader(transactionId);

    if (releaseHash) {
      await auditLogService.log({
        admin_id: adminId,
        actor_role: 'admin',
        actor_id: adminId,
        action: 'release_retry_succeeded',
        resource_type: 'transaction',
        resource_id: transactionId,
        new_value: { state: 'COMPLETE', stellar_release_tx: releaseHash },
        metadata: { trader_id: tx.trader_id },
      });
      return { status: 'complete', state: 'COMPLETE', releaseHash };
    }

    const fresh = await db.query(
      `SELECT state, failure_reason, release_error FROM transactions WHERE id = $1`,
      [transactionId]
    );
    await auditLogService.log({
      admin_id: adminId,
      actor_role: 'admin',
      actor_id: adminId,
      action: 'release_retry_blocked',
      resource_type: 'transaction',
      resource_id: transactionId,
      metadata: {
        state: fresh.rows[0]?.state,
        failure_reason: fresh.rows[0]?.failure_reason,
        release_error: fresh.rows[0]?.release_error,
      },
    });
    return { status: 'blocked', state: fresh.rows[0]?.state || RELEASE_RETRY_ALLOWED_STATE };
  } catch (err) {
    await auditLogService.log({
      admin_id: adminId,
      actor_role: 'admin',
      actor_id: adminId,
      action: 'release_retry_failed',
      resource_type: 'transaction',
      resource_id: transactionId,
      metadata: { error: err.message },
    });
    throw err;
  }
}

export default {
  handleDeposit,
  handleTraderUsdcDeposit,
  swapXlmToUsdc,
  releaseToTrader,
  releaseToUser,
  retryReleaseBlocked,
  refundXlm,
  refundToUser,
  refundOrphanTransaction,
  releaseMatchFloatForTransaction,
  restoreTraderFloat,
};
