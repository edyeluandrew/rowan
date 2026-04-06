import { Router } from 'express';
import { authAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import escrowController from '../services/escrowController.js';
import verificationService from '../services/traderVerificationService.js';
import stateMachine from '../services/transactionStateMachine.js';
import notificationService from '../services/notificationService.js';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';
import auditLogService from '../services/auditLogService.js';

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
      SELECT t.*, tr.name as trader_name
      FROM transactions t
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
    let trader;

    if (suspended !== false) {
      await verificationService.adminSuspendVerified(req.params.id, req.adminId, reason || 'Admin suspension');
      // Fetch updated trader for broadcast
      const result = await db.query(`SELECT * FROM traders WHERE id = $1`, [req.params.id]);
      trader = result.rows[0];
    } else {
      const result = await db.query(
        `UPDATE traders SET status = 'ACTIVE', verification_status = 'VERIFIED', is_active = TRUE, is_suspended = FALSE WHERE id = $1 RETURNING *`,
        [req.params.id]
      );
      const updateResult = await db.query(
        `UPDATE trader_verifications SET verification_status = 'VERIFIED' WHERE trader_id = $1`
      );
      trader = result.rows[0];
    }

    logger.info(`[Admin] Trader ${req.params.id} ${suspended ? 'suspended' : 'unsuspended'}: ${reason || 'No reason'}`);

    // Broadcast trader update to all admins
    notificationService.notifyAdminTraderUpdate(trader, suspended ? 'trader_suspended' : 'trader_reactivated');
    // Log admin action
    notificationService.notifyAdminAction(req.adminId, `trader_${suspended ? 'suspended' : 'reactivated'}`, {
      traderId: req.params.id,
      reason: reason || 'No reason',
    });

    res.json({ success: true, traderId: req.params.id, suspended });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/overview
 * Dashboard overview: stats, alerts, recent transactions, escrow.
 */
router.get('/overview', authAdmin, async (req, res, next) => {
  try {
    // Today's transaction stats
    const txToday = await db.query(`
      SELECT
        COUNT(*) as transactions_today,
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as completed_today,
        COUNT(*) FILTER (WHERE state = 'FAILED') as failed_today,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'COMPLETE'), 0) as volume_today
      FROM transactions
      WHERE created_at >= CURRENT_DATE
    `);

    // Revenue today
    const revResult = await db.query(`
      SELECT COALESCE(SUM(q.platform_fee), 0) as revenue_today
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' AND t.completed_at >= CURRENT_DATE
    `);

    // Active traders
    const tradersResult = await db.query(`
      SELECT COUNT(*) as active_traders FROM traders WHERE status = 'ACTIVE'
    `);

    // Pending approval traders
    const pendingResult = await db.query(`
      SELECT COUNT(*) as pending_approvals FROM traders WHERE status = 'PAUSED' OR verification_status = 'SUBMITTED'
    `);

    // Open disputes
    const disputesResult = await db.query(`
      SELECT COUNT(*) as open_disputes FROM disputes WHERE status = 'OPEN'
    `);

    // Avg settlement time (minutes) for today's completed
    const avgResult = await db.query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)) as avg_settlement_time
      FROM transactions
      WHERE state = 'COMPLETE' AND completed_at >= CURRENT_DATE
    `);

    // Escrow balance — valid tx_state enum values only
    const escrowResult = await db.query(`
      SELECT COALESCE(SUM(usdc_amount), 0) as escrow_locked
      FROM transactions
      WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')
    `);

    // Success rate
    const txRow = txToday.rows[0];
    const total = parseInt(txRow.transactions_today) || 0;
    const completed = parseInt(txRow.completed_today) || 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : null;

    // Recent transactions — no users join (ambiguous columns)
    const recentResult = await db.query(`
      SELECT t.id, t.state, t.usdc_amount, t.fiat_amount, t.fiat_currency, t.created_at,
             tr.name as trader_name
      FROM transactions t
      LEFT JOIN traders tr ON tr.id = t.trader_id
      ORDER BY t.created_at DESC
      LIMIT 10
    `);

    // Alerts
    const alerts = [];
    if (parseInt(disputesResult.rows[0].open_disputes) > 0) {
      alerts.push({ type: 'warning', message: `${disputesResult.rows[0].open_disputes} open dispute(s) need attention` });
    }
    if (parseInt(pendingResult.rows[0].pending_approvals) > 0) {
      alerts.push({ type: 'info', message: `${pendingResult.rows[0].pending_approvals} trader(s) awaiting approval` });
    }

    res.json({
      stats: {
        transactions_today: parseInt(txRow.transactions_today),
        active_traders: parseInt(tradersResult.rows[0].active_traders),
        open_disputes: parseInt(disputesResult.rows[0].open_disputes),
        revenue_today: parseFloat(revResult.rows[0].revenue_today),
        volume_today: parseFloat(txRow.volume_today),
        avg_settlement_time: avgResult.rows[0].avg_settlement_time ? parseInt(avgResult.rows[0].avg_settlement_time) : null,
        pending_approvals: parseInt(pendingResult.rows[0].pending_approvals),
        escrow_locked: parseFloat(escrowResult.rows[0].escrow_locked),
        failed_today: parseInt(txRow.failed_today),
        success_rate: successRate,
      },
      alerts,
      recent_transactions: recentResult.rows,
      escrow: {
        locked: parseFloat(escrowResult.rows[0].escrow_locked),
      },
    });
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
    const todayResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as completed_today,
        COUNT(*) FILTER (WHERE state = 'FAILED') as failed_today,
        COUNT(*) FILTER (WHERE state = 'REFUNDED') as refunded_today,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'COMPLETE'), 0) as usdc_volume_today
      FROM transactions
      WHERE created_at >= CURRENT_DATE
    `);

    const revenueResult = await db.query(`
      SELECT COALESCE(SUM(q.platform_fee), 0) as revenue_today
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' AND t.completed_at >= CURRENT_DATE
    `);

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

    const tradersResult = await db.query(`
      SELECT COUNT(*) as active_traders FROM traders WHERE status = 'ACTIVE' AND verification_status = 'VERIFIED'
    `);

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
      SELECT d.*, tr.name as trader_name
      FROM disputes d
      LEFT JOIN traders tr ON tr.id = d.trader_id
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

    const result = await db.query(
      `UPDATE disputes SET status = $1, admin_notes = $2, resolved_at = NOW() WHERE id = $3 RETURNING *`,
      [resolution, adminNotes || null, req.params.id]
    );
    const dispute = result.rows[0];

    // Broadcast dispute update to all admins
    notificationService.notifyAdminDisputeUpdate(dispute, 'dispute_resolved');
    // Log admin action
    notificationService.notifyAdminAction(req.adminId, 'dispute_resolved', {
      disputeId: req.params.id,
      resolution,
      notes: adminNotes,
    });

    res.json({ success: true, disputeId: req.params.id, resolution });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/traders/onboard
 * Register a new OTC trader — starts in SUBMITTED status.
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

      const existing = await db.query(
        `SELECT id FROM traders WHERE email = $1 OR stellar_address = $2`,
        [email, stellarAddress]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email or Stellar address already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 12);

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
 * GET /api/v1/admin/traders
 * List all traders with optional filters and pagination.
 */
router.get('/traders', authAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 25, status, search } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (status) {
      const upper = status.toUpperCase();
      if (upper === 'PENDING') {
        conditions.push(`(t.verification_status = 'SUBMITTED' OR t.status = 'PAUSED')`);
      } else {
        params.push(upper);
        conditions.push(`t.status = $${params.length}`);
      }
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.name ILIKE $${params.length} OR t.email ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM traders t ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, parseInt(limit), offset];
    const result = await db.query(
      `SELECT t.id, t.name, t.email, t.status, t.trust_score, t.is_active,
              t.is_suspended, t.networks, t.float_ugx, t.daily_volume,
              t.daily_limit_ugx, t.created_at, t.updated_at,
              t.verification_status
       FROM traders t
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ traders: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/traders/pending
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
 * GET /api/v1/admin/traders/:id
 */
router.get('/traders/:id', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, COUNT(tx.id) as total_transactions,
              COUNT(tx.id) FILTER (WHERE tx.state = 'COMPLETE') as completed_transactions
       FROM traders t
       LEFT JOIN transactions tx ON tx.trader_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trader not found' });
    }
    res.json({ trader: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/traders/:id/verification
 */
router.get('/traders/:id/verification', authAdmin, async (req, res, next) => {
  try {
    const detail = await verificationService.getVerificationDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: 'No verification record found for this trader' });
    }

    const v = detail.verification;
    const docUrls = {
      idFront: await verificationService.getDocumentUrl(v.id_document_front_key),
      idBack: await verificationService.getDocumentUrl(v.id_document_back_key),
      selfie: await verificationService.getDocumentUrl(v.selfie_key),
      p2pScreenshot: await verificationService.getDocumentUrl(v.binance_screenshot_key),
    };

    const checklist = await verificationService.getPreActivationChecklist(req.params.id);

    res.json({ ...detail, docUrls, checklist });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/traders/:id/verify
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
    if (err.message.includes('Cannot verify') || err.message.includes('not accepted') || err.message.includes('already verified')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/admin/traders/:id/reject
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
 */
router.post('/refund/:quoteId', authAdmin, async (req, res, next) => {
  try {
    const txResult = await db.query(
      `SELECT t.*, q.memo
       FROM transactions t
       JOIN quotes q ON q.id = t.quote_id
       WHERE q.id = $1 AND t.state NOT IN ('COMPLETE', 'REFUNDED')`,
      [req.params.quoteId]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or already completed/refunded' });
    }

    const refundHash = await escrowController.refundXlm(
      tx.user_stellar_address || tx.stellar_address,
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
 * POST /api/v1/admin/escrow/refund-retry/:transactionId
 * Retry a failed refund for a transaction
 */
router.post('/escrow/refund-retry/:transactionId', authAdmin, async (req, res, next) => {
  try {
    const txResult = await db.query(
      `SELECT * FROM transactions WHERE id = $1`,
      [req.params.transactionId]
    );
    const tx = txResult.rows[0];
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Only allow retry for FAILED transactions that haven't been successfully refunded
    if (tx.state !== 'FAILED' && !(tx.state === 'REFUNDED' && !tx.stellar_refund_tx)) {
      return res.status(400).json({ error: `Cannot retry refund for transaction in ${tx.state} state` });
    }

    // Get user's stellar address
    const userResult = await db.query(
      `SELECT stellar_address FROM users WHERE id = $1`,
      [tx.user_id]
    );
    const userStellarAddress = userResult.rows[0]?.stellar_address;
    if (!userStellarAddress) {
      return res.status(400).json({ error: 'User has no registered Stellar address' });
    }

    // Attempt refund
    const refundHash = await escrowController.refundXlm(
      userStellarAddress,
      tx.xlm_amount,
      `Admin retry refund: ${req.body.reason || 'Retry'}`
    );

    // Transition to REFUNDED if not already
    if (tx.state === 'FAILED') {
      await stateMachine.transition(tx.id, 'FAILED', 'REFUNDED', {
        stellar_refund_tx: refundHash,
        failure_reason: `Admin refund retry: ${req.body.reason || 'Retry'}`,
      });
    } else {
      // Update stellar_refund_tx for already REFUNDED transactions
      await db.query(
        `UPDATE transactions SET stellar_refund_tx = $1 WHERE id = $2`,
        [refundHash, tx.id]
      );
    }

    // Log admin action
    await auditLogService.logAdminAction(req.adminId, 'transaction_refund_retry', {
      transaction_id: tx.id,
      reason: req.body.reason || 'Retry',
      refund_tx_hash: refundHash,
    });

    res.json({ success: true, refundTxHash: refundHash, transactionId: tx.id });
  } catch (err) { 
    next(err);
  }
});

/**
 * GET /api/v1/admin/revenue
 */
router.get('/revenue', authAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || '7d';
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days' };
    const interval = intervalMap[period];

    const dateFilter = interval ? `AND t.completed_at >= NOW() - INTERVAL '${interval}'` : '';

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

/* ═══════════════════════════════════════════════════════════
 *  ESCROW ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/escrow/status
 */
router.get('/escrow/status', authAdmin, async (req, res, next) => {
  try {
    const locked = await db.query(`
      SELECT
        COUNT(*) as active_escrows,
        COALESCE(SUM(usdc_amount), 0) as total_locked
      FROM transactions
      WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')
    `);
    const today = await db.query(`
      SELECT
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'COMPLETE'), 0) as released_today,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'REFUNDED'), 0) as refunded_today
      FROM transactions
      WHERE completed_at >= CURRENT_DATE OR refunded_at >= CURRENT_DATE
    `);
    res.json({
      active_escrows: parseInt(locked.rows[0].active_escrows),
      total_locked: parseFloat(locked.rows[0].total_locked),
      released_today: parseFloat(today.rows[0].released_today),
      refunded_today: parseFloat(today.rows[0].refunded_today),
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/escrow/transactions
 */
router.get('/escrow/transactions', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.id, t.state, t.usdc_amount, t.fiat_amount, t.fiat_currency,
             t.created_at, t.escrow_locked_at,
             tr.name as trader_name
      FROM transactions t
      LEFT JOIN traders tr ON tr.id = t.trader_id
      WHERE t.state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')
      ORDER BY t.created_at DESC
      LIMIT 100
    `);
    res.json({ transactions: result.rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/escrow/pending-refunds
 * Retrieve transactions pending refund (FAILED state or awaiting retry)
 */
router.get('/escrow/pending-refunds', authAdmin, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Fetch transactions in FAILED state (potential refunds) or REFUNDED recently
    // Also include transactions that may need refund retry
    const result = await db.query(`
      SELECT 
        t.id, 
        t.state, 
        t.usdc_amount, 
        t.fiat_amount, 
        t.fiat_currency,
        t.created_at, 
        t.failed_at,
        t.refunded_at,
        t.failure_reason,
        t.stellar_refund_tx,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(t.failed_at, t.created_at)))::int as age_seconds,
        tr.name as trader_name,
        u.phone_hash
      FROM transactions t
      LEFT JOIN traders tr ON tr.id = t.trader_id
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.state IN ('FAILED', 'REFUNDED')
      ORDER BY COALESCE(t.failed_at, t.refunded_at) DESC
      LIMIT $1 OFFSET $2
    `, [parseInt(limit), parseInt(offset)]);

    // Count total
    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM transactions 
      WHERE state IN ('FAILED', 'REFUNDED')
    `);
    const total = parseInt(countResult.rows[0]?.total || 0);

    res.json({ 
      refunds: result.rows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) { 
    next(err); 
  }
});

/* ═══════════════════════════════════════════════════════════
 *  SYSTEM / HEALTH / ALERTS ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/system/health
 */
router.get('/system/health', authAdmin, async (req, res, next) => {
  try {
    const dbStart = Date.now();
    await db.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      db: { latency_ms: dbLatency, status: 'connected' },
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/system/alerts
 */
router.get('/system/alerts', authAdmin, async (req, res, next) => {
  try {
    const alerts = [];

    const lowFloat = await db.query(`
      SELECT id, name, float_ugx FROM traders
      WHERE status = 'ACTIVE' AND float_ugx < 500000
    `);
    for (const t of lowFloat.rows) {
      alerts.push({ id: `float-${t.id}`, type: 'warning', message: `${t.name} has low float (${t.float_ugx} UGX)`, created_at: new Date().toISOString() });
    }

    const disputes = await db.query(`SELECT COUNT(*) as cnt FROM disputes WHERE status = 'OPEN'`);
    if (parseInt(disputes.rows[0].cnt) > 0) {
      alerts.push({ id: 'disputes-open', type: 'error', message: `${disputes.rows[0].cnt} open dispute(s) need resolution`, created_at: new Date().toISOString() });
    }

    const pending = await db.query(`SELECT COUNT(*) as cnt FROM traders WHERE verification_status = 'SUBMITTED'`);
    if (parseInt(pending.rows[0].cnt) > 0) {
      alerts.push({ id: 'pending-verify', type: 'info', message: `${pending.rows[0].cnt} trader(s) awaiting verification`, created_at: new Date().toISOString() });
    }

    res.json({ alerts });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/system/alerts/:id/resolve
 */
router.post('/system/alerts/:id/resolve', authAdmin, async (req, res, next) => {
  try {
    logger.info(`[Admin] Alert ${req.params.id} resolved by admin ${req.adminId}`);
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
 *  RATES ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/rates
 */
router.get('/rates', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        AVG(wholesale_rate_ugx) as avg_rate_ugx,
        MIN(wholesale_rate_ugx) as min_rate_ugx,
        MAX(wholesale_rate_ugx) as max_rate_ugx
      FROM traders
      WHERE status = 'ACTIVE'
    `);
    const row = result.rows[0];
    res.json({
      avg_rate_ugx: parseFloat(row.avg_rate_ugx) || 0,
      min_rate_ugx: parseFloat(row.min_rate_ugx) || 0,
      max_rate_ugx: parseFloat(row.max_rate_ugx) || 0,
      updated_at: new Date().toISOString(),
    });
  } catch (err) { next(err); }
});

/**
 * PATCH /api/v1/admin/rates
 */
router.patch('/rates', authAdmin, async (req, res, next) => {
  try {
    const { wholesale_rate_ugx } = req.body;
    if (!wholesale_rate_ugx) return res.status(400).json({ error: 'wholesale_rate_ugx is required' });
    await db.query(
      `UPDATE traders SET wholesale_rate_ugx = $1 WHERE status = 'ACTIVE'`,
      [parseInt(wholesale_rate_ugx)]
    );
    logger.info(`[Admin] Rates updated to ${wholesale_rate_ugx} UGX by admin ${req.adminId}`);
    res.json({ success: true, wholesale_rate_ugx: parseInt(wholesale_rate_ugx) });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
 *  ANALYTICS ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/analytics/revenue
 */
router.get('/analytics/revenue', authAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || '30d';
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[period];
    const dateFilter = interval ? `AND t.completed_at >= NOW() - INTERVAL '${interval}'` : '';

    const byDay = await db.query(`
      SELECT DATE(t.completed_at) as date,
             COUNT(*) as transactions,
             COALESCE(SUM(q.platform_fee), 0) as revenue,
             COALESCE(SUM(t.usdc_amount), 0) as volume
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' ${dateFilter}
      GROUP BY DATE(t.completed_at)
      ORDER BY date ASC
    `);

    const totals = await db.query(`
      SELECT
        COUNT(*) as total_transactions,
        COALESCE(SUM(q.platform_fee), 0) as total_revenue,
        COALESCE(SUM(t.usdc_amount), 0) as total_volume
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' ${dateFilter}
    `);

    res.json({ period, byDay: byDay.rows, totals: totals.rows[0] });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/analytics/volume
 */
router.get('/analytics/volume', authAdmin, async (req, res, next) => {
  try {
    const period = req.query.period || '30d';
    const intervalMap = { '1d': '1 day', '7d': '7 days', '30d': '30 days', '90d': '90 days' };
    const interval = intervalMap[period];
    const dateFilter = interval ? `AND t.created_at >= NOW() - INTERVAL '${interval}'` : '';

    const byDay = await db.query(`
      SELECT DATE(t.created_at) as date,
             COUNT(*) as transactions,
             COALESCE(SUM(t.usdc_amount), 0) as usdc_volume,
             COALESCE(SUM(t.fiat_amount), 0) as fiat_volume
      FROM transactions t
      WHERE t.state = 'COMPLETE' ${dateFilter}
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `);

    const byNetwork = await db.query(`
      SELECT t.network, COUNT(*) as transactions,
             COALESCE(SUM(t.fiat_amount), 0) as fiat_volume
      FROM transactions t
      WHERE t.state = 'COMPLETE' ${dateFilter}
      GROUP BY t.network
      ORDER BY fiat_volume DESC
    `);

    res.json({ period, byDay: byDay.rows, byNetwork: byNetwork.rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/analytics/traders
 */
router.get('/analytics/traders', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT tr.id, tr.name, tr.trust_score, tr.daily_volume, tr.float_ugx,
             COUNT(t.id) as total_transactions,
             COUNT(t.id) FILTER (WHERE t.state = 'COMPLETE') as completed,
             COUNT(t.id) FILTER (WHERE t.state = 'FAILED') as failed,
             COALESCE(SUM(t.usdc_amount) FILTER (WHERE t.state = 'COMPLETE'), 0) as usdc_volume
      FROM traders tr
      LEFT JOIN transactions t ON t.trader_id = tr.id
      WHERE tr.status = 'ACTIVE'
      GROUP BY tr.id
      ORDER BY usdc_volume DESC
    `);
    res.json({ traders: result.rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/analytics/users
 */
router.get('/analytics/users', authAdmin, async (req, res, next) => {
  try {
    const totals = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_users_7d,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_30d
      FROM public.users
    `);

    const byDay = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as signups
      FROM public.users
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    res.json({ ...totals.rows[0], signups_by_day: byDay.rows });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
 *  ADDITIONAL TRANSACTION ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/transactions/:id
 */
router.get('/transactions/:id', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*, tr.name as trader_name,
             q.platform_fee, q.market_rate, q.user_rate
      FROM transactions t
      LEFT JOIN traders tr ON tr.id = t.trader_id
      LEFT JOIN quotes q ON q.id = t.quote_id
      WHERE t.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: result.rows[0] });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/transactions/:id/force-refund
 */
router.post('/transactions/:id/force-refund', authAdmin, async (req, res, next) => {
  try {
    const tx = await db.query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (tx.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.rows[0].state === 'COMPLETE' || tx.rows[0].state === 'REFUNDED') {
      return res.status(400).json({ error: `Cannot refund transaction in ${tx.rows[0].state} state` });
    }
    await stateMachine.transition(req.params.id, tx.rows[0].state, 'REFUNDED', {
      failure_reason: `Admin force refund: ${req.body.reason || ''}`
    });
    logger.info(`[Admin] Force refunded tx ${req.params.id} by admin ${req.adminId}`);
    res.json({ success: true, transactionId: req.params.id });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/transactions/:id/force-complete
 */
router.post('/transactions/:id/force-complete', authAdmin, async (req, res, next) => {
  try {
    const tx = await db.query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (tx.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.rows[0].state === 'COMPLETE' || tx.rows[0].state === 'REFUNDED') {
      return res.status(400).json({ error: `Cannot complete transaction in ${tx.rows[0].state} state` });
    }
    await stateMachine.transition(req.params.id, tx.rows[0].state, 'COMPLETE', {
      failure_reason: `Admin force complete: ${req.body.reason || ''}`
    });
    logger.info(`[Admin] Force completed tx ${req.params.id} by admin ${req.adminId}`);
    res.json({ success: true, transactionId: req.params.id });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/transactions/:id/reassign
 */
router.post('/transactions/:id/reassign', authAdmin, async (req, res, next) => {
  try {
    const { traderId } = req.body;
    if (!traderId) return res.status(400).json({ error: 'traderId is required' });
    const tx = await db.query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
    if (tx.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    await db.query('UPDATE transactions SET trader_id = $1, trader_matched_at = NOW() WHERE id = $2', [traderId, req.params.id]);
    logger.info(`[Admin] Reassigned tx ${req.params.id} to trader ${traderId} by admin ${req.adminId}`);
    res.json({ success: true, transactionId: req.params.id, traderId });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
 *  ADDITIONAL DISPUTE ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/disputes/:id
 */
router.get('/disputes/:id', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT d.*, tr.name as trader_name,
             t.state as transaction_state, t.usdc_amount, t.fiat_amount, t.fiat_currency
      FROM disputes d
      LEFT JOIN traders tr ON tr.id = d.trader_id
      LEFT JOIN transactions t ON t.id = d.transaction_id
      WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dispute not found' });
    res.json({ dispute: result.rows[0] });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/disputes/:id/resolve
 */
router.post('/disputes/:id/resolve', authAdmin, async (req, res, next) => {
  try {
    const { resolution, adminNotes } = req.body;
    if (!resolution) return res.status(400).json({ error: 'resolution is required' });

    // Map resolution to valid dispute_status enum values
    const statusMap = {
      'refund': 'RESOLVED_FOR_USER',
      'RESOLVED_FOR_USER': 'RESOLVED_FOR_USER',
      'RESOLVED_FOR_TRADER': 'RESOLVED_FOR_TRADER',
      'DISMISSED': 'DISMISSED',
      'dismiss': 'DISMISSED',
    };
    const dbStatus = statusMap[resolution] || 'RESOLVED_FOR_USER';

    await db.query(
      `UPDATE disputes SET status = $1, admin_notes = $2, resolved_at = NOW() WHERE id = $3`,
      [dbStatus, adminNotes || resolution, req.params.id]
    );
    logger.info(`[Admin] Dispute ${req.params.id} resolved: ${dbStatus}`);
    res.json({ success: true, disputeId: req.params.id, resolution: dbStatus });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/disputes/:id/escalate
 */
router.post('/disputes/:id/escalate', authAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    await db.query(
      `UPDATE disputes SET status = 'UNDER_REVIEW', admin_notes = COALESCE(admin_notes, '') || $1 WHERE id = $2`,
      [`\n[ESCALATED] ${reason || 'No reason provided'}`, req.params.id]
    );
    logger.info(`[Admin] Dispute ${req.params.id} escalated: ${reason}`);
    res.json({ success: true, disputeId: req.params.id });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/disputes/:id/note
 */
router.post('/disputes/:id/note', authAdmin, async (req, res, next) => {
  try {
    const { note } = req.body;
    if (!note) return res.status(400).json({ error: 'note is required' });
    await db.query(
      `UPDATE disputes SET admin_notes = COALESCE(admin_notes, '') || $1 WHERE id = $2`,
      [`\n[NOTE] ${note}`, req.params.id]
    );
    res.json({ success: true, disputeId: req.params.id });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/audit-log
 */
router.post('/audit-log', authAdmin, async (req, res) => {
  const { action, details } = req.body;
  logger.info(`[AuditLog] Admin ${req.adminId}: ${action}`, details);
  try {
    await auditLogService.logAdminAction(req.adminId, action, details);
  } catch (err) {
    logger.error('Failed to log admin action:', err);
  }
  res.json({ logged: true });
});

/**
 * GET /api/v1/admin/audit-logs
 * Retrieve audit logs with optional filters.
 */
router.get('/audit-logs', authAdmin, async (req, res, next) => {
  try {
    const filters = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
      action: req.query.action,
      entity_type: req.query.entity_type,
      search: req.query.search,
      date_from: req.query.date_from,
    };

    const result = await auditLogService.getAuditLogs(filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/audit-logs/:id
 * Retrieve a single audit log entry.
 */
router.get('/audit-logs/:id', authAdmin, async (req, res, next) => {
  try {
    const log = await auditLogService.getAuditLog(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    res.json(log);
  } catch (err) {
    next(err);
  }
});

export default router;