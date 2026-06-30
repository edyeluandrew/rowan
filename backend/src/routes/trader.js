import { Router } from 'express';
import { authTrader, signToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import matchingEngine from '../services/matchingEngine.js';
import buyMatchingEngine from '../services/buyMatchingEngine.js';
import escrowController from '../services/escrowController.js';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { stroopsToUsdc } from '../utils/financial.js';
import { maskPhoneNumber } from '../utils/phoneMasking.js';
import { traderLoginLimiter, sensitiveActionLimiter } from '../middleware/rateLimits.js';
import multer from 'multer';
import disputeEvidenceService from '../services/disputeEvidenceService.js';
import storageService from '../services/storageService.js';
import notificationService from '../services/notificationService.js';
import { formatShortId } from '../utils/shortId.js';
import { server as horizon, USDC_ASSET } from '../config/stellar.js';

const router = Router();

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const payoutProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/jpg'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPEG and PNG images are allowed'), ok);
  },
});

function usdcBalanceOf(account) {
  if (!account?.balances) return { balance: 0, hasTrustline: false };
  const b = account.balances.find(
    (x) => x.asset_code === USDC_ASSET.code && x.asset_issuer === USDC_ASSET.issuer
  );
  return { balance: b ? Number(b.balance) : 0, hasTrustline: !!b };
}

/**
 * POST /api/v1/trader/login
 * Trader authentication.
 * Body: { email, password }
 * Returns: token (if no 2FA) or 2faRequired: true (if 2FA enabled)
 */
router.post(
  '/login',
  traderLoginLimiter,
  validate(['email', 'password']),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const result = await db.query(
        `SELECT * FROM traders WHERE email = $1`,
        [email]
      );
      const trader = result.rows[0];

      if (!trader || !(await bcrypt.compare(password, trader.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // ── [M-9 FIX] Status-specific login error messages ──
      if (trader.status === 'BANNED') {
        return res.status(403).json({ error: 'Account permanently banned. Contact support.' });
      }
      if (trader.status === 'SUSPENDED' || trader.is_suspended) {
        return res.status(403).json({ error: 'Account suspended pending review. Contact support.' });
      }
      if (trader.status === 'PAUSED') {
        // Paused traders can still log in, they just won't receive matches
      }

      // === NEW: CHECK IF 2FA IS ENABLED ===
      const twoFaResult = await db.query(
        `SELECT is_enabled FROM trader_2fa_settings WHERE trader_id = $1`,
        [trader.id]
      );
      const twoFaSettings = twoFaResult.rows[0];
      const has2faEnabled = twoFaSettings && twoFaSettings.is_enabled === true;

      if (has2faEnabled) {
        // Return 2FA challenge required response (do not issue full token yet)
        return res.json({
          requiresTwoFactor: true,
          traderId: trader.id,
          message: 'Enter your authentication code to continue',
        });
      }

      // === NO 2FA: Proceed with normal login ===
      const token = signToken(trader.id, 'trader');

      // Update last active
      await db.query(
        `UPDATE traders SET last_active_at = NOW(), is_active = TRUE WHERE id = $1`,
        [trader.id]
      );

      res.json({
        token,
        trader: {
          id: trader.id,
          name: trader.name,
          stellarAddress: trader.stellar_address,
          usdcFloat: trader.usdc_float,
          dailyLimit: trader.daily_limit,
          dailyVolume: trader.daily_volume,
          trustScore: trader.trust_score,
          verificationStatus: trader.verification_status,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/trader/requests
 * List pending requests assigned to this trader.
 * Query params: status (optional: 'pending', 'active', or all if not provided)
 */
router.get('/requests', authTrader, async (req, res, next) => {
  try {
    const { status } = req.query; // May be undefined

    // NEVER pass undefined to SQL — build query conditionally
    let query = `SELECT id, xlm_amount, usdc_amount, fiat_amount, fiat_currency, network,
                        state, trader_matched_at, created_at, payout_phone
                 FROM transactions
                 WHERE trader_id = $1`;
    
    const params = [req.traderId];

    // Only add status filter if status param was provided
    if (status === 'pending') {
      query += ` AND state = $2`;
      params.push('TRADER_MATCHED');
    } else if (status === 'active') {
      query += ` AND state IN ($2, $3)`;
      params.push('FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING');
    }
    // If status not provided or unknown value: return ALL trader requests (no additional filter)

    query += ` ORDER BY trader_matched_at DESC NULLS LAST`;

    // LOG before query for debugging
    console.log('[GET /trader/requests] QUERY PARAMS:', {
      traderId: req.traderId,
      statusParam: status || '(not provided)',
      queryParams: params,
    });

    const result = await db.query(query, params);

    // [USDC FIX] usdc_amount is NUMERIC(18,7) decimal, not stroops — don't divide.
    // pg returns NUMERIC as string; coerce to Number for the JSON payload.
    const acceptTimeoutMs = (config.platform.traderAcceptTimeoutSeconds || 180) * 1000;
    const requests = result.rows.map(tx => {
      const matchedAt = tx.trader_matched_at ? new Date(tx.trader_matched_at).getTime() : Date.now();
      const deadline = new Date(matchedAt + acceptTimeoutMs).toISOString();
      return {
        ...tx,
        usdc_amount: Number(tx.usdc_amount) || 0,
        xlm_amount: Number(tx.xlm_amount) || 0,
        payout_phone_masked: tx.payout_phone ? maskPhoneNumber(tx.payout_phone) : 'Unknown',
        payout_phone: undefined,
        accept_deadline: deadline,
        expires_at: deadline,
      };
    });

    // RETURN SAFE RESPONSE with success flag
    res.json({
      success: true,
      data: requests,
    });
  } catch (err) {
    // WRAP in try/catch and log FULL error
    console.error('[GET /trader/requests] ERROR:', {
      message: err.message,
      stack: err.stack,
      traderId: req.traderId,
    });
    next(err);
  }
});

/**
 * GET /api/v1/trader/requests/:id
 * Get a single request assigned to this trader (full detail).
 * Returns full payout details (phone, name) only for this trader.
 */
router.get('/requests/:id', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.id, t.usdc_amount, t.xlm_amount, t.fiat_amount, t.fiat_currency,
              t.network, t.state, t.trader_matched_at, t.matched_at,
              t.fiat_sent_at, t.created_at, t.completed_at, t.user_id, t.trader_id,
              t.payout_phone, t.payout_name, t.stellar_release_tx, t.payment_expires_at,
              t.preferred_payout_setting_id, t.order_side, t.payout_reference,
              q.memo AS escrow_memo, q.escrow_address,
              tr.stellar_address
       FROM transactions t
       JOIN traders tr ON tr.id = t.trader_id
       LEFT JOIN quotes q ON q.id = t.quote_id
       WHERE t.id = $1 AND t.trader_id = $2`,
      [req.params.id, req.traderId]
    );

    const tx = result.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Request not found or not assigned to you' });
    }

    // [USDC FIX] usdc_amount is NUMERIC(18,7) decimal, not stroops.
    res.json({
      data: {
        ...tx,
        usdc_amount: Number(tx.usdc_amount) || 0,
        selection_method: tx.preferred_payout_setting_id ? 'manual' : 'auto',
        // Full payout details returned only to assigned trader
        payout_phone: tx.payout_phone || 'Unknown',
        payout_name: tx.payout_name || 'Unknown',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/accept
 * Trader accepts a cash-out request.
 */
/**
 * POST /api/v1/trader/requests/:id/accept
 * Trader accepts a cash-out request.
 * Returns full request data including payout details.
 */
router.post('/requests/:id/accept', authTrader, async (req, res, next) => {
  try {
    logger.info(`[Trader] Accepting request ${req.params.id} for trader ${req.traderId}`);

    const sideCheck = await db.query(
      `SELECT order_side FROM transactions WHERE id = $1 AND trader_id = $2`,
      [req.params.id, req.traderId]
    );
    const orderSide = sideCheck.rows[0]?.order_side || 'SELL';

    if (orderSide === 'BUY') {
      await buyMatchingEngine.acceptBuyRequest(req.params.id, req.traderId);
    } else {
      await matchingEngine.acceptRequest(req.params.id, req.traderId);
    }
    
    // Fetch full request data to return to frontend
    const result = await db.query(
      `SELECT t.id, t.usdc_amount, t.xlm_amount, t.fiat_amount, t.fiat_currency,
              t.network, t.state, t.trader_matched_at, t.matched_at,
              t.fiat_sent_at, t.created_at, t.user_id, t.trader_id,
              t.payout_phone, t.payout_name, t.order_side,
              q.memo AS escrow_memo, q.escrow_address
       FROM transactions t
       LEFT JOIN quotes q ON q.id = t.quote_id
       WHERE t.id = $1 AND t.trader_id = $2`,
      [req.params.id, req.traderId]
    );
    
    const tx = result.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    logger.info(`[Trader] ✅ Request ${req.params.id} accepted. State: ${tx.state}, matched_at: ${tx.matched_at}`);
    
    res.json({
      success: true,
      data: {
        ...tx,
        usdc_amount: Number(tx.usdc_amount) || 0,
        xlm_amount: Number(tx.xlm_amount) || 0,
        payout_phone: tx.payout_phone || 'Unknown',
        payout_name: tx.payout_name || 'Unknown',
      },
    });
  } catch (err) {
    logger.error(`[Trader] ❌ Accept request ${req.params.id} failed:`, err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code || undefined });
    }
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/confirm
 * Trader confirms they have sent mobile money.
 *
 * [B4 FIX] Wraps escrow release in try/catch. On failure, enqueues a
 * Bull retry job so the trader still receives their USDC.
 */
router.post('/requests/:id/payout-sent', authTrader, sensitiveActionLimiter, payoutProofUpload.single('proof_image'), async (req, res, next) => {
  try {
    const reference = req.body?.reference;

    if (!reference || typeof reference !== 'string' || reference.trim().length === 0) {
      return res.status(400).json({
        error: 'Mobile money reference is required',
        details: 'Please provide a valid reference number from your mobile money provider.',
      });
    }

    let proofStorageKey = null;
    let proofSignedUrl = null;

    if (req.file) {
      proofStorageKey = await storageService.saveChatImage(
        req.file.buffer,
        req.file.originalname,
        req.params.id
      );
      const signed = await storageService.getSignedUrl(proofStorageKey, 60 * 60 * 24 * 30);
      proofSignedUrl = signed?.url || null;
    }

    const transaction = await matchingEngine.submitPayoutSent(
      req.params.id,
      req.traderId,
      reference.trim(),
      { proofStorageKey, proofSignedUrl }
    );

    res.json({
      status: 'FIAT_PAYOUT_SUBMITTED',
      message: 'Payment submitted. Waiting for customer confirmation before USDC is released.',
      transaction: {
        id: transaction.id,
        state: transaction.state,
        payout_reference: transaction.payout_reference,
        payout_proof_url: proofSignedUrl,
        short_id: formatShortId(transaction.id),
      },
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/fiat-received
 * Trader confirms MoMo received on a BUY order — releases USDC to user.
 */
router.post('/requests/:id/fiat-received', authTrader, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const { transaction, releaseHash } = await buyMatchingEngine.confirmFiatReceived(
      req.params.id,
      req.traderId
    );
    res.json({
      success: true,
      status: transaction.state,
      releaseTxHash: releaseHash,
      message: releaseHash
        ? 'Payment confirmed. USDC released to the customer.'
        : 'Payment confirmed. USDC release pending (check trustline).',
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

/**
 * DEPRECATED: POST /requests/:id/confirm
 *
 * This endpoint used the obsolete FIAT_SENT state to release escrow immediately
 * on the trader's word. That bypassed user receipt confirmation and is removed.
 *
 * Canonical flow:
 *   POST /requests/:id/payout-sent  (partner submits mobile money reference)
 *   → user confirms receipt: POST /user/transactions/:id/confirm-receipt
 *   → escrow releases USDC to the partner.
 *
 * Returns 410 Gone so any stale client surfaces the correct flow.
 */
router.post('/requests/:id/confirm', authTrader, async (req, res) => {
  return res.status(410).json({
    error: 'Endpoint deprecated',
    message: 'Submit your mobile money reference via /requests/:id/payout-sent. USDC is released after the customer confirms receipt.',
    canonicalEndpoint: 'POST /api/v1/trader/requests/:id/payout-sent',
  });
});

/**
 * GET /api/v1/trader/profile
 * Full trader profile for the Profile page.
 */
router.get('/profile', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, stellar_address, usdc_float,
              daily_limit, daily_volume, trust_score, status,
              verification_status, is_active, networks,
              float_ugx, float_kes, float_tzs,
              created_at, updated_at, last_active_at
       FROM traders WHERE id = $1`,
      [req.traderId]
    );
    const trader = result.rows[0];
    if (!trader) return res.status(404).json({ error: 'Trader not found' });

    // Build float_balances object for the frontend
    const float_balances = {};
    if (trader.float_ugx > 0) float_balances.UGX = Number(trader.float_ugx);
    if (trader.float_kes > 0) float_balances.KES = Number(trader.float_kes);
    if (trader.float_tzs > 0) float_balances.TZS = Number(trader.float_tzs);

    res.json({
      trader: {
        ...trader,
        float_balances,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/history?page=1&limit=20
 * Paginated transaction history for the History page.
 */
router.get('/history', authTrader, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, network,
              state, stellar_release_tx, completed_at, created_at
       FROM transactions
       WHERE trader_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.traderId, limit, offset]
    );

    // [USDC FIX] usdc_amount is NUMERIC(18,7) decimal, not stroops.
    const transactions = result.rows.map(tx => ({
      ...tx,
      usdc_amount: Number(tx.usdc_amount) || 0,
    }));

    res.json({ transactions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/stats
 * Trader's float balance, daily volume, and recent history.
 */
router.get('/stats', authTrader, async (req, res, next) => {
  try {
    const traderResult = await db.query(
      `SELECT usdc_float, daily_limit, daily_volume, trust_score
       FROM traders WHERE id = $1`,
      [req.traderId]
    );

    const historyResult = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, state, completed_at, created_at
       FROM transactions
       WHERE trader_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.traderId]
    );

    // [USDC FIX] usdc_amount is NUMERIC(18,7) decimal, not stroops.
    const recentTransactions = historyResult.rows.map(tx => ({
      ...tx,
      usdc_amount: Number(tx.usdc_amount) || 0,
    }));

    const todayResult = await db.query(
      `SELECT COUNT(*) as tx_count, COALESCE(SUM(usdc_amount), 0) as total_usdc
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE' AND completed_at >= CURRENT_DATE`,
      [req.traderId]
    );

    // Convert total_usdc from stroops to decimal
    const todayStats = {
      ...todayResult.rows[0],
      total_usdc: Number(todayResult.rows[0].total_usdc) || 0,
    };

    // Lifetime stats for History page header
    const lifetimeResult = await db.query(
      `SELECT COUNT(*) as completed_count,
              COALESCE(SUM(fiat_amount), 0) as total_volume_ugx,
              COALESCE(SUM(fiat_amount * 0.02), 0) as total_earnings_ugx
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE'`,
      [req.traderId]
    );

    res.json({
      ...traderResult.rows[0],
      today: todayStats,
      recentTransactions,
      ...lifetimeResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/requests/:id/decline
 * Trader declines a request. Backend re-runs matching to next available trader.
 */
router.post('/requests/:id/decline', authTrader, async (req, res, next) => {
  try {
    const txResult = await db.query(
      `SELECT * FROM transactions WHERE id = $1 AND trader_id = $2 AND state = 'TRADER_MATCHED'`,
      [req.params.id, req.traderId]
    );
    const tx = txResult.rows[0];
    if (!tx) return res.status(404).json({ error: 'Request not found or not in a declinable state' });

    // Unassign trader and re-match
    await escrowController.releaseMatchFloatForTransaction(tx);

    await db.query(
      `UPDATE transactions SET trader_id = NULL, payout_setting_id = NULL, state = 'ESCROW_LOCKED', trader_matched_at = NULL
       WHERE id = $1`,
      [req.params.id]
    );

    // Slight trust score decay for declining
    await db.query(
      `UPDATE traders SET trust_score = GREATEST(0, trust_score - 1) WHERE id = $1`,
      [req.traderId]
    );

    // Re-run matching algorithm
    matchingEngine.matchTrader(tx.id).catch((err) => {
      logger.error(`[Trader] Re-match after decline failed:`, err.message);
    });

    res.json({ success: true, message: 'Request declined. It will be routed to another trader.' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/trader/float
 * Trader updates their declared available fiat float.
 * Body: { floatUgx?, floatKes?, floatTzs? } — at least one required
 * [H-6 FIX] Support all three currency float columns.
 */
router.put('/float', authTrader, async (req, res, next) => {
  try {
    const { floatUgx, floatKes, floatTzs } = req.body;

    // At least one must be provided
    if (floatUgx === undefined && floatKes === undefined && floatTzs === undefined) {
      return res.status(400).json({ error: 'At least one of floatUgx, floatKes, floatTzs is required' });
    }

    // Build dynamic SET clause
    const sets = [];
    const params = [];
    let idx = 1;

    if (floatUgx !== undefined && floatUgx !== null) {
      if (parseFloat(floatUgx) < 0) return res.status(400).json({ error: 'floatUgx must be >= 0' });
      sets.push(`float_ugx = $${idx++}`);
      params.push(parseInt(floatUgx));
    }
    if (floatKes !== undefined && floatKes !== null) {
      if (parseFloat(floatKes) < 0) return res.status(400).json({ error: 'floatKes must be >= 0' });
      sets.push(`float_kes = $${idx++}`);
      params.push(parseInt(floatKes));
    }
    if (floatTzs !== undefined && floatTzs !== null) {
      if (parseFloat(floatTzs) < 0) return res.status(400).json({ error: 'floatTzs must be >= 0' });
      sets.push(`float_tzs = $${idx++}`);
      params.push(parseInt(floatTzs));
    }

    params.push(req.traderId);
    await db.query(
      `UPDATE traders SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );

    res.json({
      success: true,
      ...(floatUgx !== undefined && { floatUgx: parseInt(floatUgx) }),
      ...(floatKes !== undefined && { floatKes: parseInt(floatKes) }),
      ...(floatTzs !== undefined && { floatTzs: parseInt(floatTzs) }),
      message: 'Float updated. You will now be matched for requests within your declared float.',
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════
 *  WALLET ENDPOINT
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/trader/wallet
 * Stellar wallet details: address, USDC balance, recent receipts.
 */
router.get('/wallet', authTrader, async (req, res, next) => {
  try {
    const traderResult = await db.query(
      `SELECT stellar_address, usdc_float FROM traders WHERE id = $1`,
      [req.traderId]
    );
    const trader = traderResult.rows[0];
    if (!trader) return res.status(404).json({ error: 'Trader not found' });

    let usdcBalance = parseFloat(trader.usdc_float) || 0;
    let usdcTrustline = false;
    let balanceSource = 'legacy';

    if (trader.stellar_address) {
      try {
        const account = await horizon.loadAccount(trader.stellar_address);
        const { balance, hasTrustline } = usdcBalanceOf(account);
        usdcBalance = balance;
        usdcTrustline = hasTrustline;
        balanceSource = 'horizon';
      } catch (err) {
        const notFound = err?.response?.status === 404 || /not found/i.test(err.message || '');
        if (!notFound) {
          logger.warn(`[Trader] Horizon balance load failed for ${req.traderId}: ${err.message}`);
        }
      }
    }

    // Recent completed transactions (USDC receipts to this trader)
    const txResult = await db.query(
      `SELECT id, usdc_amount, fiat_amount, fiat_currency, state,
              stellar_release_tx, completed_at, created_at
       FROM transactions
       WHERE trader_id = $1 AND state = 'COMPLETE' AND stellar_release_tx IS NOT NULL
       ORDER BY completed_at DESC NULLS LAST, created_at DESC
       LIMIT 20`,
      [req.traderId]
    );

    res.json({
      stellar_address: trader.stellar_address,
      usdc_balance: usdcBalance,
      usdc_trustline: usdcTrustline,
      balance_source: balanceSource,
      recent_transactions: txResult.rows.map((row) => ({
        ...row,
        usdc_amount: Number(row.usdc_amount) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/wallet/verify
 * Verify / update the trader's Stellar receiving address.
 */
router.post('/wallet/verify', authTrader, async (req, res, next) => {
  try {
    const { stellarAddress } = req.body;
    if (!stellarAddress || !stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      return res.status(400).json({ error: 'Invalid Stellar address. Must start with G and be 56 characters.' });
    }

    // Check uniqueness
    const existing = await db.query(
      `SELECT id FROM traders WHERE stellar_address = $1 AND id != $2`,
      [stellarAddress, req.traderId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This Stellar address is already registered to another trader.' });
    }

    await db.query(
      `UPDATE traders SET stellar_address = $1, updated_at = NOW() WHERE id = $2`,
      [stellarAddress, req.traderId]
    );

    logger.info(`[Trader] ${req.traderId} updated Stellar address to ${stellarAddress}`);
    res.json({ success: true, stellar_address: stellarAddress });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════
 *  SLA PERFORMANCE ENDPOINT
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/trader/sla?period=30d
 * SLA metrics: met rate, avg payout time, breaches, breakdown.
 * SLA target: payout within 5 minutes (300s) of being matched.
 */
router.get('/sla', authTrader, async (req, res, next) => {
  try {
    const period = req.query.period || '30d';
    const intervalMap = { '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[period] || '30 days';

    // Get all completed/failed transactions in period with payout timing
    const txResult = await db.query(
      `SELECT id,
              EXTRACT(EPOCH FROM (fiat_sent_at - trader_matched_at)) as payout_seconds,
              EXTRACT(EPOCH FROM (trader_matched_at - escrow_locked_at)) as response_seconds,
              fiat_sent_at, trader_matched_at, completed_at, state
       FROM transactions
       WHERE trader_id = $1
         AND state IN ('COMPLETE', 'FAILED')
         AND trader_matched_at IS NOT NULL
         AND created_at >= NOW() - $2::INTERVAL
       ORDER BY created_at DESC`,
      [req.traderId, interval]
    );

    const txs = txResult.rows;
    const SLA_TARGET = 300; // 5 minutes in seconds

    // Filter valid transactions (have both matched and fiat_sent timestamps)
    const withPayout = txs.filter(t => t.payout_seconds != null && t.payout_seconds >= 0);

    const totalWithPayout = withPayout.length;
    const slaMet = withPayout.filter(t => t.payout_seconds <= SLA_TARGET).length;
    const slaBreaches = totalWithPayout - slaMet;
    const slaMetRate = totalWithPayout > 0 ? (slaMet / totalWithPayout) * 100 : 100;

    const avgPayout = totalWithPayout > 0
      ? withPayout.reduce((s, t) => s + t.payout_seconds, 0) / totalWithPayout
      : 0;

    const withResponse = txs.filter(t => t.response_seconds != null && t.response_seconds >= 0);
    const avgResponse = withResponse.length > 0
      ? withResponse.reduce((s, t) => s + t.response_seconds, 0) / withResponse.length
      : 0;

    const bestTime = withPayout.length > 0
      ? Math.min(...withPayout.map(t => t.payout_seconds))
      : null;

    // Breakdown: last 20 transactions
    const breakdown = withPayout.slice(0, 20).map(t => ({
      transaction_id: t.id,
      payout_time: Math.round(t.payout_seconds),
      met: t.payout_seconds <= SLA_TARGET,
    }));

    res.json({
      slaMetRate: Math.round(slaMetRate * 10) / 10,
      averagePayoutTime: Math.round(avgPayout),
      averageResponseTime: Math.round(avgResponse),
      slaBreaches,
      best_time: bestTime != null ? Math.round(bestTime) : null,
      breakdown,
    });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════════════════════════════════════════════
 *  NETWORK PERFORMANCE ENDPOINT
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/trader/performance/networks
 * Per-network stats: completion rate, avg time, volume.
 */
router.get('/performance/networks', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT
         t.network,
         COUNT(*) as total_transactions,
         COUNT(*) FILTER (WHERE t.state = 'COMPLETE') as completed,
         ROUND(
           COUNT(*) FILTER (WHERE t.state = 'COMPLETE')::NUMERIC /
           NULLIF(COUNT(*), 0) * 100, 1
         ) as completion_rate,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (t.fiat_sent_at - t.trader_matched_at)))
           FILTER (WHERE t.fiat_sent_at IS NOT NULL AND t.trader_matched_at IS NOT NULL)
         ) as avg_time,
         COALESCE(SUM(t.fiat_amount) FILTER (WHERE t.state = 'COMPLETE'), 0) as total_volume
       FROM transactions t
       WHERE t.trader_id = $1
         AND t.state IN ('COMPLETE', 'FAILED', 'REFUNDED')
       GROUP BY t.network
       ORDER BY total_transactions DESC`,
      [req.traderId]
    );

    const byNetwork = result.rows.map(row => ({
      network: row.network,
      totalTransactions: parseInt(row.total_transactions),
      completionRate: parseFloat(row.completion_rate) || 0,
      avg_time: row.avg_time != null ? parseInt(row.avg_time) : null,
      total_volume: parseFloat(row.total_volume) || 0,
    }));

    res.json({ byNetwork });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/notifications/unread
 */
router.get('/notifications/unread', authTrader, async (req, res, next) => {
  try {
    const count = await notificationService.unreadCount(req.traderId, 'trader');
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/notifications
 */
router.get('/notifications', authTrader, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const rows = await notificationService.listNotifications(req.traderId, 'trader', limit, offset);
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM trader_inapp_notifications WHERE trader_id = $1`,
      [req.traderId]
    );

    const notifications = rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      transaction_id: n.transaction_id,
      transactionId: n.transaction_id,
      read_at: n.read_at,
      readAt: n.read_at,
      is_read: !!n.read_at,
      created_at: n.created_at,
      createdAt: n.created_at,
    }));

    res.json({
      notifications,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/trader/notifications/:id/read
 */
router.patch('/notifications/:id/read', authTrader, async (req, res, next) => {
  try {
    await notificationService.markRead(req.params.id, req.traderId, 'trader');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/trader/notifications/read-all
 */
router.patch('/notifications/read-all', authTrader, async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.traderId, 'trader');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/notifications/mark-read
 * Mark specific trader notifications as read.
 * Body: { notificationIds: [uuid, uuid, ...] }
 */
router.post('/notifications/mark-read', authTrader, async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'notificationIds array required' });
    }

    for (const nid of notificationIds) {
      await notificationService.markRead(nid, req.traderId, 'trader');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/trader/notifications/mark-all-read
 */
router.post('/notifications/mark-all-read', authTrader, async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.traderId, 'trader');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/float/health
 * Show current float balance and health status.
 */
router.get('/float/health', authTrader, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, is_active, float_ugx, float_kes, float_tzs, 
              daily_limit, daily_volume, trust_score, last_active_at
       FROM traders
       WHERE id = $1`,
      [req.traderId]
    );

    const trader = result.rows[0];
    if (!trader) {
      return res.status(404).json({ error: 'Trader not found' });
    }

    // Calculate float health percentage
    const minFloat = 100000; // Minimum expected float
    const floatUgxHealth = Math.min(100, (trader.float_ugx / minFloat) * 100);
    const floatKesHealth = Math.min(100, (trader.float_kes / minFloat) * 100);
    const floatTzsHealth = Math.min(100, (trader.float_tzs / minFloat) * 100);

    res.json({
      traderId: trader.id,
      name: trader.name,
      isActive: trader.is_active,
      floats: {
        ugx: {
          balance: parseFloat(trader.float_ugx),
          health: Math.round(floatUgxHealth),
        },
        kes: {
          balance: parseFloat(trader.float_kes),
          health: Math.round(floatKesHealth),
        },
        tzs: {
          balance: parseFloat(trader.float_tzs),
          health: Math.round(floatTzsHealth),
        },
      },
      dailyLimit: parseFloat(trader.daily_limit),
      dailyVolume: parseFloat(trader.daily_volume),
      remainingDaily: parseFloat(trader.daily_limit) - parseFloat(trader.daily_volume),
      trustScore: parseFloat(trader.trust_score),
      lastActiveAt: trader.last_active_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/disputes/:disputeId/evidence
 */
router.get('/disputes/:disputeId/evidence', authTrader, async (req, res, next) => {
  try {
    const evidence = await disputeEvidenceService.listEvidence(req.params.disputeId, {
      traderId: req.userId,
    });
    res.json({ evidence });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/trader/disputes/:disputeId/evidence
 */
router.post(
  '/disputes/:disputeId/evidence',
  authTrader,
  evidenceUpload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Evidence file is required' });
      }
      const evidence = await disputeEvidenceService.uploadEvidence(
        req.params.disputeId,
        { traderId: req.userId },
        req.file
      );
      res.status(201).json({ success: true, evidence });
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      next(err);
    }
  }
);

export default router;
