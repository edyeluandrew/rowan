import { Router } from 'express';
import { authAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import escrowController from '../services/escrowController.js';
import verificationService from '../services/traderVerificationService.js';
import stateMachine from '../services/transactionStateMachine.js';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/admin/transactions
 * List all transactions with optional filters.
 * Query: ?state=COMPLETE&limit=50&offset=0
 */
router.get('/transactions', authAdmin, async (req, res, next) => {
  try {
    const { state, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT t.*, u.stellar_address as user_stellar, tr.name as trader_name
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN traders tr ON tr.id = t.trader_id
    `;
    const params = [];
    if (state) {
      params.push(state);
      query += ` WHERE t.state = $${params.length}`;
    }
    params.push(parseInt(limit));
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    res.json({ transactions: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/traders/:id/suspend
 * Suspend or unsuspend a trader.
 * Body: { suspended: true/false, reason? }
 */
router.put('/traders/:id/suspend', authAdmin, async (req, res, next) => {
  try {
    const { suspended, reason } = req.body;
    // ── [M-6 FIX] Single-write: delegate entirely to verificationService ──
    if (suspended !== false) {
      await verificationService.adminSuspendVerified(req.params.id, req.adminId, reason || 'Admin suspension');
    } else {
      // Unsuspend — restore to VERIFIED/ACTIVE
      await db.query(
        `UPDATE traders SET status = 'ACTIVE', verification_status = 'VERIFIED', is_active = TRUE, is_suspended = FALSE WHERE id = $1`,
        [req.params.id]
      );
      await db.query(
        `UPDATE trader_verifications SET verification_status = 'VERIFIED' WHERE trader_id = $1`,
        [req.params.id]
      );
    }

    logger.info(`[Admin] Trader ${req.params.id} ${suspended ? 'suspended' : 'unsuspended'}: ${reason || 'No reason'}`);
    res.json({ success: true, traderId: req.params.id, suspended });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/metrics
 * Platform revenue and volume metrics.
 */
router.get('/metrics', authAdmin, async (req, res, next) => {
  try {
    // Today's metrics
    const todayResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as completed_today,
        COUNT(*) FILTER (WHERE state = 'FAILED') as failed_today,
        COUNT(*) FILTER (WHERE state = 'REFUNDED') as refunded_today,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'COMPLETE'), 0) as usdc_volume_today
      FROM transactions
      WHERE created_at >= CURRENT_DATE
    `);

    // Platform fee revenue today
    const revenueResult = await db.query(`
      SELECT COALESCE(SUM(q.platform_fee), 0) as revenue_today
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' AND t.completed_at >= CURRENT_DATE
    `);

    // All-time metrics
    const allTimeResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as total_completed,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'COMPLETE'), 0) as total_usdc_volume
      FROM transactions
    `);

    const allTimeRevenueResult = await db.query(`
      SELECT COALESCE(SUM(q.platform_fee), 0) as total_revenue
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE'
    `);

    // Active traders — [M-7 FIX] Use status enum instead of boolean flags
    const tradersResult = await db.query(`
      SELECT COUNT(*) as active_traders FROM traders WHERE status = 'ACTIVE' AND verification_status = 'VERIFIED'
    `);

    // Active disputes
    const disputesResult = await db.query(`
      SELECT COUNT(*) as open_disputes FROM disputes WHERE status = 'OPEN'
    `);

    res.json({
      today: {
        ...todayResult.rows[0],
        revenue: revenueResult.rows[0].revenue_today,
      },
      allTime: {
        ...allTimeResult.rows[0],
        revenue: allTimeRevenueResult.rows[0].total_revenue,
      },
      activeTraders: parseInt(tradersResult.rows[0].active_traders),
      openDisputes: parseInt(disputesResult.rows[0].open_disputes),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/disputes
 * List disputes with filters.
 */
router.get('/disputes', authAdmin, async (req, res, next) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = `
      SELECT d.*, u.stellar_address as user_stellar, tr.name as trader_name
      FROM disputes d
      JOIN users u ON u.id = d.user_id
      JOIN traders tr ON tr.id = d.trader_id
    `;
    const params = [];
    if (status) {
      params.push(status);
      query += ` WHERE d.status = $${params.length}`;
    }
    params.push(parseInt(limit));
    query += ` ORDER BY d.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json({ disputes: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/disputes/:id/resolve
 * Resolve a dispute.
 * Body: { resolution: 'RESOLVED_FOR_USER' | 'RESOLVED_FOR_TRADER' | 'DISMISSED', adminNotes? }
 */
router.put('/disputes/:id/resolve', authAdmin, async (req, res, next) => {
  try {
    const { resolution, adminNotes } = req.body;
    const validResolutions = ['RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED'];
    if (!validResolutions.includes(resolution)) {
      return res.status(400).json({ error: `Resolution must be one of: ${validResolutions.join(', ')}` });
    }

    await db.query(
      `UPDATE disputes SET status = $1, admin_notes = $2, resolved_at = NOW() WHERE id = $3`,
      [resolution, adminNotes || null, req.params.id]
    );

    res.json({ success: true, disputeId: req.params.id, resolution });
  } catch (err) {
    next(err);
  }
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * BREAKING CHANGE — Trader Onboard Endpoint Rewrite
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * OLD BEHAVIOR (pre-verification system):
 *   - Created trader with status='ACTIVE' and trust_score=100.
 *   - Trader was immediately eligible for matching pool.
 *   - No verification, no document upload, no agreement required.
 *
 * NEW BEHAVIOR:
 *   - Creates trader with status='PAUSED', verification_status='SUBMITTED',
 *     and trust_score=50.
 *   - Trader CANNOT receive matches until the full verification pipeline
 *     completes: document upload → agreement acceptance → MoMo OTP
 *     verification → admin triple-check review → VERIFIED.
 *   - Only admin adminVerifyTrader() sets status='ACTIVE' +
 *     verification_status='VERIFIED', which makes the trader matchable.
 *
 * WHY:
 *   Before this change, any admin could create a fully active trader with
 *   no identity check, no proof of mobile money ownership, no P2P history,
 *   and no legal agreement. This is unacceptable for a money transmission
 *   platform — even at MVP with 2-3 traders. The verification pipeline
 *   enforces medium-strictness KYC that can be tightened in Phase 2.
 *
 * MIGRATION:
 *   Any traders created under the old behavior are already ACTIVE and
 *   will NOT have a trader_verifications record. They will continue to
 *   match. To bring them into the new system, create a verification
 *   record manually and run them through the review process.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/**
 * POST /api/v1/admin/traders/onboard
 * Register a new OTC trader — starts in SUBMITTED status.
 * Trader must complete verification (docs, agreement, MoMo OTP) before activation.
 * Body: { name, email, password, stellarAddress, networks, floatUgx, dailyLimitUgx, wholesaleRateUgx }
 */
router.post(
  '/traders/onboard',
  authAdmin,
  validate(['name', 'email', 'password', 'stellarAddress']),
  async (req, res, next) => {
    try {
      const {
        name, email, password, stellarAddress,
        networks = ['MTN_UG'], floatUgx = 0,
        dailyLimitUgx = 15000000, wholesaleRateUgx = 3950,
      } = req.body;

      // Check duplicates
      const existing = await db.query(
        `SELECT id FROM traders WHERE email = $1 OR stellar_address = $2`,
        [email, stellarAddress]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email or Stellar address already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create trader in SUBMITTED status — NOT ACTIVE
      const result = await db.query(
        `INSERT INTO traders
           (name, email, stellar_address, password_hash, networks, float_ugx,
            daily_limit_ugx, wholesale_rate_ugx, status, verification_status, trust_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PAUSED', 'SUBMITTED', 50.00)
         RETURNING id, name, email, stellar_address, networks, float_ugx, trust_score, status, verification_status`,
        [name, email, stellarAddress, passwordHash, networks,
         parseInt(floatUgx), parseInt(dailyLimitUgx), parseInt(wholesaleRateUgx)]
      );

      const trader = result.rows[0];

      // Create blank verification record
      await verificationService.createVerificationRecord(trader.id);

      res.status(201).json({
        trader,
        message: 'Trader created in SUBMITTED status. They must complete verification before receiving matches.',
        nextSteps: [
          'Trader logs in and submits documents: POST /api/v1/trader/onboarding/submit',
          'Trader accepts agreement: POST /api/v1/trader/onboarding/confirm-agreement',
          'Trader verifies MoMo: POST /api/v1/trader/onboarding/momo/request-otp + verify-otp',
          'Admin reviews and verifies: POST /api/v1/admin/traders/:id/verify',
        ],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/traders/pending
 * List all traders awaiting verification review.
 */
router.get('/traders/pending', authAdmin, async (req, res, next) => {
  try {
    const traders = await verificationService.getPendingTraders();
    res.json({ traders, count: traders.length });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/traders/:id/verification
 * Full verification detail for a specific trader: docs, MoMo accounts, checklist.
 */
router.get('/traders/:id/verification', authAdmin, async (req, res, next) => {
  try {
    const detail = await verificationService.getVerificationDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: 'No verification record found for this trader' });
    }

    // Generate signed document URLs for admin review (Supabase Storage)
    const v = detail.verification;
    const docUrls = {
      idFront: await verificationService.getDocumentUrl(v.id_document_front_key),
      idBack: await verificationService.getDocumentUrl(v.id_document_back_key),
      selfie: await verificationService.getDocumentUrl(v.selfie_key),
      p2pScreenshot: await verificationService.getDocumentUrl(v.binance_screenshot_key),
    };

    // Get pre-activation checklist
    const checklist = await verificationService.getPreActivationChecklist(req.params.id);

    res.json({ ...detail, docUrls, checklist });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/traders/:id/verify
 * Admin verifies trader — all checks must pass (triple-check enforcement).
 * Body: { notes?, checks?: { identity?: 'PASSED'|'FAILED', momo?: ..., p2p?: ... } }
 */
router.post('/traders/:id/verify', authAdmin, async (req, res, next) => {
  try {
    const result = await verificationService.adminVerifyTrader(
      req.params.id,
      req.adminId,
      { notes: req.body.notes, checks: req.body.checks }
    );
    res.json({ success: true, ...result, message: 'Trader verified and activated. They will now receive matches.' });
  } catch (err) {
    // Validation errors (missing agreement, failed checks) → 400
    if (err.message.includes('Cannot verify') || err.message.includes('not accepted') || err.message.includes('already verified')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/admin/traders/:id/reject
 * Admin rejects trader — trader can re-submit documents.
 * Body: { notes, failedChecks?: { identity?: 'FAILED', momo?: 'FAILED', p2p?: 'FAILED' } }
 */
router.post('/traders/:id/reject', authAdmin, async (req, res, next) => {
  try {
    const result = await verificationService.adminRejectTrader(
      req.params.id,
      req.adminId,
      { notes: req.body.notes, failedChecks: req.body.failedChecks }
    );
    res.json({ success: true, ...result, message: 'Trader rejected. They may re-submit documents.' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/traders/:id/checklist
 * Pre-activation checklist for a specific trader.
 */
router.get('/traders/:id/checklist', authAdmin, async (req, res, next) => {
  try {
    const checklist = await verificationService.getPreActivationChecklist(req.params.id);
    if (!checklist) {
      return res.status(404).json({ error: 'No verification record found' });
    }
    res.json(checklist);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/traders/documents/:traderId/:fileId
 * Generate a signed redirect URL for a trader's uploaded document.
 * Documents are stored in Supabase Storage (private bucket). This endpoint
 * generates a time-limited signed URL and redirects the admin to it.
 */
router.get('/traders/documents/:traderId/:fileId', authAdmin, async (req, res, next) => {
  try {
    const { default: storageService } = await import('../services/storageService.js');
    const storageKey = `${req.params.traderId}/${req.params.fileId}`;
    const signed = await storageService.getSignedUrl(storageKey);
    if (!signed) {
      return res.status(404).json({ error: 'Document not found or URL generation failed' });
    }
    res.redirect(signed.url);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/refund/:quoteId
 * Manually trigger an escrow refund to the user.
 * Emergency override for stuck transactions.
 */
router.post('/refund/:quoteId', authAdmin, async (req, res, next) => {
  try {
    const txResult = await db.query(
      `SELECT t.*, u.stellar_address as user_stellar
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       JOIN quotes q ON q.id = t.quote_id
       WHERE q.id = $1 AND t.state NOT IN ('COMPLETE', 'REFUNDED')`,
      [req.params.quoteId]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or already completed/refunded' });
    }

    const refundHash = await escrowController.refundXlm(
      tx.user_stellar,
      tx.xlm_amount,
      `Admin manual refund: ${req.body.reason || 'No reason provided'}`
    );

    await stateMachine.transition(tx.id, tx.state, 'REFUNDED', {
      stellar_refund_tx: refundHash,
      failure_reason: `Admin refund: ${req.body.reason || ''}`,
    });

    res.json({ success: true, refundTxHash: refundHash, transactionId: tx.id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/revenue
 * Platform revenue breakdown by day, trader, network, and country.
 * Query: ?period=7d (default 7d, options: 1d, 7d, 30d, all)
 */
router.get('/revenue', authAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || '7d';
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days' };
    const interval = intervalMap[period];

    const dateFilter = interval ? `AND t.completed_at >= NOW() - INTERVAL '${interval}'` : '';

    // Revenue by day
    const byDayResult = await db.query(`
      SELECT DATE(t.completed_at) as day,
             COUNT(*) as tx_count,
             COALESCE(SUM(q.platform_fee), 0) as fee_revenue,
             COALESCE(SUM(t.platform_revenue_ugx), 0) as total_revenue_ugx
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' ${dateFilter}
      GROUP BY DATE(t.completed_at)
      ORDER BY day DESC
    `);

    // Revenue by trader
    const byTraderResult = await db.query(`
      SELECT tr.id, tr.name,
             COUNT(*) as tx_count,
             COALESCE(SUM(t.usdc_amount), 0) as usdc_volume,
             COALESCE(SUM(q.platform_fee), 0) as fee_revenue
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      JOIN traders tr ON tr.id = t.trader_id
      WHERE t.state = 'COMPLETE' ${dateFilter}
      GROUP BY tr.id, tr.name
      ORDER BY fee_revenue DESC
    `);

    // Revenue by network/country
    const byNetworkResult = await db.query(`
      SELECT t.network,
             COUNT(*) as tx_count,
             COALESCE(SUM(t.fiat_amount), 0) as fiat_volume,
             COALESCE(SUM(q.platform_fee), 0) as fee_revenue
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' ${dateFilter}
      GROUP BY t.network
      ORDER BY fiat_volume DESC
    `);

    res.json({
      period,
      byDay: byDayResult.rows,
      byTrader: byTraderResult.rows,
      byNetwork: byNetworkResult.rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
