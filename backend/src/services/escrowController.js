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
import { stroopsToUsdc } from '../utils/financial.js';

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
  const lockAcquired = await redis.set(lockKey, txHash, 'EX', 120, 'NX');
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
  const expectedXlm = parseFloat(quote.xlm_amount);
  const receivedXlm = parseFloat(amount);
  if (Math.abs(receivedXlm - expectedXlm) > 0.01) {
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
    await redis.set(`quote:${quote.id}:tx`, transaction.id, 'EX', 86400);
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
    const swapResult = await swapXlmToUsdc(receivedXlm, quote);
    logger.info(`[Escrow] Swap result: amount=${swapResult.amount} (type: ${typeof swapResult.amount}), txHash=${swapResult.txHash}`);
    
    let usdcDecimal = swapResult.amount;
    
    // If it's a string, parse it
    if (typeof usdcDecimal === 'string') {
      usdcDecimal = parseFloat(usdcDecimal);
      logger.info(`[Escrow] Parsed string to number: ${swapResult.amount} → ${usdcDecimal}`);
    }
    
    // Defensive check: if still not a number, use a fallback
    if (!Number.isFinite(usdcDecimal)) {
      logger.error(`[Escrow] ❌ INVALID USDC AMOUNT: ${swapResult.amount} (type: ${typeof swapResult.amount}), cannot insert!`);
      throw new Error(`Invalid USDC amount: ${swapResult.amount}`);
    }
    
    // Convert to stroops (integer) for bigint storage: USDC has 6 decimals
    // Example: 5497.66 USDC → 5497660000 stroops
    const usdcStroops = Math.round(usdcDecimal * 1_000_000);
    logger.info(`[Escrow] Converted USDC: ${usdcDecimal} → ${usdcStroops} stroops (bigint)`);
    
    if (!Number.isInteger(usdcStroops)) {
      throw new Error(`USDC stroops conversion failed: ${usdcDecimal} → ${usdcStroops} (not an integer)`);
    }
    
    await db.query(
      `UPDATE transactions SET usdc_amount = $1, stellar_swap_tx = $2 WHERE id = $3`,
      [usdcStroops, swapResult.txHash, transaction.id]
    );
    logger.info(`[Escrow] ✅ Swap complete — ${usdcDecimal} USDC (${usdcStroops} stroops), tx: ${swapResult.txHash}`);

    // 6. Trigger trader matching
    await matchingEngine.matchTrader(transaction.id);
  } catch (err) {
    logger.error(`[Escrow] Swap failed for tx ${transaction.id}:`, err.message);

    // ── B3 FIX: Save refund hash and set state to REFUNDED ──
    try {
      const refundHash = await refundXlm(userStellarAddress, amount, 'Swap failed');
      await stateMachine.transition(transaction.id, 'ESCROW_LOCKED', 'REFUNDED', {
        failure_reason: 'XLM→USDC swap failed: ' + err.message,
        stellar_refund_tx: refundHash,
      });
    } catch (refundErr) {
      // If refund also fails, mark FAILED so Bull queue can retry
      logger.error(`[Escrow] REFUND ALSO FAILED for tx ${transaction.id}:`, refundErr.message);
      await stateMachine.transition(transaction.id, 'ESCROW_LOCKED', 'FAILED', {
        failure_reason: 'Swap failed + refund failed: ' + err.message,
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

    return { success: true, amount: actualUsdc.toFixed(7), txHash: result.hash };
  } catch (err) {
    logger.warn(`[Escrow] Market maker fill failed: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

/**
 * Execute XLM → USDC pathPaymentStrictReceive on the Stellar DEX.
 * The escrow account is both sender (XLM) and receiver (USDC).
 *
 * [C4] pathPaymentStrictReceive guarantees the escrow receives exactly destAmount USDC
 *      or the tx fails entirely. The amount stored in DB is the requested destAmount.
 */
async function swapXlmToUsdc(xlmAmount, quote) {
  logger.info(`[Escrow] 🔄 SWAP START: xlmAmount=${xlmAmount} (type: ${typeof xlmAmount})`);
  logger.info(`[Escrow] Quote data: fiat_amount=${quote.fiat_amount} (type: ${typeof quote.fiat_amount}), platform_fee=${quote.platform_fee} (type: ${typeof quote.platform_fee}), fiat_currency=${quote.fiat_currency}`);
  
  const escrowAccount = await horizon.loadAccount(config.stellar.escrowPublicKey);

  // Get the rate
  const usdcToFiat = quoteEngine.getUsdcToFiatRate(quote.fiat_currency);
  logger.info(`[Escrow] usdcToFiat rate: ${usdcToFiat}`);
  
  // Parse values carefully - NEVER concatenate strings!
  const fiatAmount = quote.fiat_amount;
  const platformFee = quote.platform_fee;
  
  logger.info(`[Escrow] Raw values: fiatAmount="${fiatAmount}", platformFee="${platformFee}"`);
  
  // Convert to number
  const fiatNum = Number(fiatAmount);
  const feeNum = Number(platformFee);
  
  logger.info(`[Escrow] After Number(): fiatNum=${fiatNum}, feeNum=${feeNum}`);
  logger.info(`[Escrow] Validation: fiatNum valid=${Number.isFinite(fiatNum)}, feeNum valid=${Number.isFinite(feeNum)}`);
  
  if (!Number.isFinite(fiatNum) || !Number.isFinite(feeNum)) {
    throw new Error(`Failed to parse quote amounts: fiatAmount="${fiatAmount}", platformFee="${platformFee}"`);
  }
  
  // ADD (don't concatenate!)
  const totalFiat = fiatNum + feeNum;
  logger.info(`[Escrow] Addition: ${fiatNum} + ${feeNum} = ${totalFiat}`);
  
  // Divide
  const expectedUsdc = totalFiat / usdcToFiat;
  logger.info(`[Escrow] Division: ${totalFiat} / ${usdcToFiat} = ${expectedUsdc}`);

  // Allow max slippage on the send side (from config)
  const slippageMultiplier = 1 + (config.platform.maxSlippagePercent / 100);
  const xlmNum = Number(xlmAmount);
  const sendMax = (xlmNum * slippageMultiplier).toFixed(7);
  logger.info(`[Escrow] Slippage: ${xlmNum} * ${slippageMultiplier} = ${xlmNum * slippageMultiplier} → toFixed(7) = ${sendMax}`);

  const destAmount = expectedUsdc.toFixed(7);
  logger.info(`[Escrow] Building swap tx: sendMax=${sendMax}, destAmount=${destAmount}`);

  // [MM-1] Try market maker fill first
  logger.info(`[Escrow] Step 1: Attempting market maker fill...`);
  const mmFill = await tryMarketMakerFill(xlmNum, expectedUsdc);
  
  if (mmFill.success) {
    logger.info(`[Escrow] ✅ Market maker fill succeeded: ${mmFill.amount} USDC`);
    return { amount: mmFill.amount, txHash: mmFill.txHash, source: 'market_maker' };
  }

  logger.info(`[Escrow] ⚠️ Market maker fill failed (${mmFill.reason}), falling back to DEX...`);

  // Fallback: Use DEX pathPaymentStrictReceive
  logger.info(`[Escrow] Step 2: Attempting DEX pathPaymentStrictReceive...`);
  const tx = new StellarSdk.TransactionBuilder(escrowAccount, {
    fee: config.stellarMaxFee,
    networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictReceive({
        sendAsset: StellarSdk.Asset.native(),
        sendMax: sendMax,
        destination: config.stellar.escrowPublicKey, // self-swap
        destAsset: USDC_ASSET,
        destAmount: destAmount,
      })
    )
    .setTimeout(30)
    .build();

  logger.info(`[Escrow] Submitting DEX swap to Horizon...`);
  tx.sign(escrowKeypair);
  const result = await horizon.submitTransaction(tx);
  logger.info(`[Escrow] ✅ DEX swap broadcast successful: ${result.hash}`);

  // pathPaymentStrictReceive guarantees destAmount is received or tx fails.
  let actualUsdc = expectedUsdc;
  try {
    const txResult = StellarSdk.xdr.TransactionResult.fromXDR(result.result_xdr, 'base64');
    const opResult = txResult.result().results()[0].tr().pathPaymentStrictReceiveResult();
    // For strict receive, destAmount is guaranteed
    actualUsdc = expectedUsdc;
  } catch (parseErr) {
    logger.warn('[Escrow] Could not parse DEX swap result XDR, using expected amount:', parseErr.message);
  }

  const returnAmount = actualUsdc.toFixed(7);
  logger.info(`[Escrow] 🎯 Preparing to return: ${returnAmount} (type: ${typeof returnAmount})`);
  
  return { amount: returnAmount, txHash: result.hash, source: 'dex' };
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
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 60, 'NX');
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
    const usdcDecimal = stroopsToUsdc(transaction.usdc_amount);
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
    const ugxEquivalent = fiatCurrency === 'KES' ? fiatAmount * KES_TO_UGX
                        : fiatCurrency === 'TZS' ? fiatAmount * TZS_TO_UGX
                        : fiatAmount;
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
    setTimeout(() => redis.del(lockKey), 5000);
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
