import { Router } from 'express';
import { authAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import escrowController from '../services/escrowController.js';
import verificationService from '../services/traderVerificationService.js';
import disputeService from '../services/disputeService.js';
import stateMachine from '../services/transactionStateMachine.js';
import notificationService from '../services/notificationService.js';
import healthService from '../services/healthService.js';
import reconciliationService from '../services/reconciliationService.js';
import sanctionsService from '../services/sanctionsService.js';
import fraudMonitor from '../services/fraudMonitor.js';
import db from '../db/index.js';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';
import auditLogService from '../services/auditLogService.js';
import { sensitiveActionLimiter } from '../middleware/rateLimits.js';
import config from '../config/index.js';

const router = Router();

/**
 * GET /api/v1/admin/transactions
 * List all transactions with optional filters.
 * Query: ?state=COMPLETE&limit=50&offset=0
 */
router.get('/transactions', authAdmin, async (req, res, next) => {
  try {
    const {
      state,
      network,
      search,
      from,
      to,
      stuckPayoutOnly,
      staleMinutes,
      limit = 50,
      offset,
      page = 1,
    } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const requestedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offsetNum = offset != null
      ? Math.max(parseInt(offset, 10) || 0, 0)
      : (requestedPage - 1) * limitNum;
    const currentPage = offset != null ? Math.floor(offsetNum / limitNum) + 1 : requestedPage;
    const staleMinutesNum = Math.max(
      parseInt(staleMinutes, 10) || config.platform.orphanFiatSentMinutes,
      1
    );
    const stuckOnly = String(stuckPayoutOnly) === 'true';
    const params = [];
    const where = [];

    if (state) {
      params.push(state);
      where.push(`t.state = $${params.length}`);
    }
    if (network) {
      params.push(network);
      where.push(`t.network = $${params.length}`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`(
        t.id::text ILIKE $${params.length}
        OR COALESCE(t.payout_phone, '') ILIKE $${params.length}
        OR COALESCE(t.payout_name, '') ILIKE $${params.length}
        OR COALESCE(tr.name, '') ILIKE $${params.length}
      )`);
    }
    if (from) {
      params.push(from);
      where.push(`t.created_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`t.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (stuckOnly) {
      where.push(`t.state = 'FIAT_PAYOUT_SUBMITTED'`);
      params.push(staleMinutesNum);
      where.push(`COALESCE(t.fiat_sent_at, t.updated_at, t.created_at) <= NOW() - ($${params.length} * INTERVAL '1 minute')`);
    }

    const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const baseQuery = `
      FROM transactions t
      LEFT JOIN traders tr ON tr.id = t.trader_id
    `;
    const countResult = await db.query(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const query = `
      SELECT t.*, tr.name as trader_name
      ${baseQuery}
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    const result = await db.query(query, [...params, limitNum, offsetNum]);
    res.json({
      transactions: result.rows,
      total,
      page: currentPage,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    });
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
      WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING')
    `);

    // Stuck fiat payouts that need manual review
    const stuckPayoutResult = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM transactions
       WHERE state = 'FIAT_PAYOUT_SUBMITTED'
         AND fiat_payout_submitted_at < NOW() - INTERVAL '1 minute' * $1`,
      [config.platform.orphanFiatSentMinutes]
    );

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
      alerts.push({
        severity: 'warning',
        message: `${disputesResult.rows[0].open_disputes} open dispute(s) need attention`,
        timestamp: 'now',
      });
    }
    if (parseInt(pendingResult.rows[0].pending_approvals) > 0) {
      alerts.push({
        severity: 'info',
        message: `${pendingResult.rows[0].pending_approvals} trader(s) awaiting approval`,
        timestamp: 'now',
      });
    }
    if ((stuckPayoutResult.rows[0]?.count || 0) > 0) {
      alerts.push({
        severity: 'warning',
        message: `${stuckPayoutResult.rows[0].count} payout(s) have been awaiting user confirmation too long and need admin review`,
        timestamp: 'now',
        actionLabel: 'Review payouts',
        actionUrl: '/transactions?state=FIAT_PAYOUT_SUBMITTED&stuckPayoutOnly=true',
      });
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
        stuck_payouts: parseInt(stuckPayoutResult.rows[0]?.count || 0),
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
    const { status, priority, search, limit = 50, offset, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const requestedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offsetNum = offset != null
      ? Math.max(parseInt(offset, 10) || 0, 0)
      : (requestedPage - 1) * limitNum;
    const currentPage = offset != null ? Math.floor(offsetNum / limitNum) + 1 : requestedPage;
    const priorityExpr = `
      CASE
        WHEN d.status IN ('RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED', 'CLOSED') THEN 'resolved'
        WHEN d.status = 'ESCALATED' THEN 'high'
        WHEN d.sla_deadline IS NOT NULL AND d.sla_deadline <= NOW() + INTERVAL '12 hours' THEN 'high'
        WHEN d.sla_deadline IS NOT NULL AND d.sla_deadline <= NOW() + INTERVAL '24 hours' THEN 'medium'
        WHEN d.status = 'OPEN' THEN 'medium'
        ELSE 'low'
      END
    `;
    const baseQuery = `
      FROM disputes d
      LEFT JOIN traders tr ON tr.id = d.trader_id
      LEFT JOIN transactions t ON t.id = d.transaction_id
    `;
    const params = [];
    const where = [];

    if (status) {
      params.push(status);
      where.push(`d.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      where.push(`(${priorityExpr}) = $${params.length}`);
    }
    if (search?.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(`(
        d.id::text ILIKE $${params.length}
        OR d.transaction_id::text ILIKE $${params.length}
        OR COALESCE(d.reason, '') ILIKE $${params.length}
        OR COALESCE(tr.name, '') ILIKE $${params.length}
      )`);
    }

    const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    const countResult = await db.query(
      `SELECT COUNT(*) as total ${baseQuery}${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0, 10);

    const query = `
      SELECT d.*, tr.name as trader_name,
             t.state as transaction_state, t.usdc_amount, t.fiat_amount, t.fiat_currency, t.network,
             ${priorityExpr} as priority
      ${baseQuery}
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    const result = await db.query(query, [...params, limitNum, offsetNum]);
    res.json({
      disputes: result.rows,
      total,
      page: currentPage,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/admin/disputes/:id/resolve
 * [PHASE 2H] Deprecated — DB-only dispute resolution bypasses escrow settlement.
 * Use POST /api/v1/admin/disputes/:id/resolve instead.
 */
router.put('/disputes/:id/resolve', authAdmin, async (req, res, next) => {
  try {
    await auditLogService.log({
      actor_role: 'admin',
      actor_id: req.adminId,
      action: 'dangerous_endpoint_blocked',
      resource_type: 'dispute',
      resource_id: req.params.id,
      metadata: {
        endpoint: 'PUT /admin/disputes/:id/resolve',
        attempted_resolution: req.body?.resolution || null,
        redirect: 'POST /admin/disputes/:id/resolve',
      },
    });
    return res.status(410).json({
      error: 'Endpoint deprecated',
      message: 'DB-only dispute resolution is disabled. Use POST /api/v1/admin/disputes/:id/resolve for escrow-integrated settlement.',
      useInstead: 'POST /api/v1/admin/disputes/:id/resolve',
    });
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
    await auditLogService.log({
      admin_id: req.adminId,
      actor_role: 'admin',
      action: 'trader_verify_approve',
      resource_type: 'trader',
      resource_id: req.params.id,
      new_value: { verification_status: 'VERIFIED' },
      metadata: { notes: req.body.notes },
    });
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
    await auditLogService.log({
      admin_id: req.adminId,
      actor_role: 'admin',
      action: 'trader_verify_reject',
      resource_type: 'trader',
      resource_id: req.params.id,
      new_value: { verification_status: 'REJECTED' },
      metadata: { notes: req.body.notes, failedChecks: req.body.failedChecks },
    });
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
 * [PHASE 2H-2] Pre-swap XLM refunds only. Post-swap must use escrow-integrated paths.
 */
router.post('/refund/:quoteId', authAdmin, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const txResult = await db.query(
      `SELECT t.*, u.stellar_address AS user_stellar
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

    const postSwap = !!(tx.stellar_swap_tx && Number(tx.usdc_amount) > 0);
    if (postSwap) {
      await auditLogService.log({
        actor_role: 'admin',
        actor_id: req.adminId,
        action: 'dangerous_endpoint_blocked',
        resource_type: 'transaction',
        resource_id: tx.id,
        metadata: {
          endpoint: 'POST /admin/refund/:quoteId',
          reason: 'post_swap_usdc_refund_not_allowed',
          redirect: 'POST /admin/escrow/refund-retry/:transactionId',
        },
      });
      return res.status(409).json({
        error: 'Post-swap refund blocked',
        message: 'This transaction has already swapped to USDC. Use POST /api/v1/admin/escrow/refund-retry/:transactionId or dispute resolution.',
        useInstead: `POST /api/v1/admin/escrow/refund-retry/${tx.id}`,
      });
    }

    const refundHash = await escrowController.refundXlm(
      tx.user_stellar,
      tx.xlm_amount,
      `Admin manual refund (pre-swap): ${req.body.reason || 'No reason provided'}`
    );

    await stateMachine.transition(tx.id, tx.state, 'REFUNDED', {
      stellar_refund_tx: refundHash,
      failure_reason: `Admin refund: ${req.body.reason || ''}`,
    });

    await auditLogService.log({
      actor_role: 'admin',
      actor_id: req.adminId,
      action: 'admin_manual_refund',
      resource_type: 'transaction',
      resource_id: tx.id,
      new_value: { state: 'REFUNDED', stellar_refund_tx: refundHash },
      metadata: { quoteId: req.params.quoteId, asset: 'XLM', pre_swap: true },
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
router.post('/escrow/refund-retry/:transactionId', authAdmin, sensitiveActionLimiter, async (req, res, next) => {
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
 * POST /api/v1/admin/escrow/release-retry/:transactionId
 * [PHASE 2H-3B] Retry USDC release for RELEASE_BLOCKED transactions after root cause is fixed.
 */
router.post('/escrow/release-retry/:transactionId', authAdmin, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const result = await escrowController.retryReleaseBlocked(req.params.transactionId, {
      adminId: req.adminId,
    });

    if (result.status === 'already_complete') {
      return res.json({
        success: true,
        status: 'already_complete',
        state: result.state,
        releaseHash: result.releaseHash,
        transactionId: req.params.transactionId,
      });
    }

    if (result.status === 'complete') {
      return res.json({
        success: true,
        state: result.state,
        releaseHash: result.releaseHash,
        transactionId: req.params.transactionId,
      });
    }

    if (result.status === 'blocked') {
      return res.status(409).json({
        error: 'Release still blocked',
        state: result.state,
        message: 'USDC could not be released. Verify trader USDC trustline, escrow balance, and Horizon connectivity.',
        transactionId: req.params.transactionId,
      });
    }

    return res.status(500).json({ error: 'Unexpected release retry result' });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
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
      WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING')
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
      WHERE t.state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING')
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

/**
 * GET /api/v1/admin/reconciliation
 * Escrow reconciliation: on-chain USDC vs DB liability + drift + float snapshot.
 * Money-safety keystone — a negative drift (shortfall) is CRITICAL.
 */
router.get('/reconciliation', authAdmin, async (req, res, next) => {
  try {
    const report = await reconciliationService.getEscrowReconciliation();
    res.json(report);
  } catch (err) { next(err); }
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

    // [PHASE 2C] Liquidity / escrow / pipeline health for operations visibility.
    let liquidity = null;
    try { liquidity = await healthService.getLiquidityHealth(); }
    catch (e) { liquidity = { warningLevel: 'CRITICAL', criticals: ['health check failed: ' + e.message] }; }

    const overall = liquidity?.warningLevel === 'CRITICAL' ? 'degraded'
                  : liquidity?.warningLevel === 'WARNING' ? 'warning' : 'healthy';

    res.json({
      status: overall,
      uptime: process.uptime(),
      db: { latency_ms: dbLatency, status: 'connected' },
      memory: process.memoryUsage(),
      liquidity,
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
 *  FRAUD ALERTS ENDPOINTS
 *  Surfaces the fraud_alerts table (written by fraudMonitor) so ops
 *  can review + acknowledge AML/velocity/limit-breach signals.
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/fraud-alerts
 * Query: acknowledged (true|false), severity, type, limit, offset
 */
router.get('/fraud-alerts', authAdmin, async (req, res, next) => {
  try {
    const { acknowledged, severity, type } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [];
    const params = [];

    if (acknowledged === 'true' || acknowledged === 'false') {
      params.push(acknowledged === 'true');
      conditions.push(`fa.acknowledged = $${params.length}`);
    }
    if (severity) {
      params.push(String(severity).toUpperCase());
      conditions.push(`fa.severity = $${params.length}`);
    }
    if (type) {
      params.push(String(type).toUpperCase());
      conditions.push(`fa.alert_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT fa.id, fa.user_id, fa.trader_id, fa.alert_type, fa.details,
              fa.severity, fa.acknowledged, fa.acknowledged_by, fa.acknowledged_at,
              fa.created_at,
              u.email           AS user_email,
              u.stellar_address AS user_stellar,
              u.kyc_level       AS user_kyc,
              t.name            AS trader_name
         FROM fraud_alerts fa
         LEFT JOIN users u   ON u.id = fa.user_id
         LEFT JOIN traders t ON t.id = fa.trader_id
         ${where}
         ORDER BY fa.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const counts = await db.query(
      `SELECT
         COUNT(*)::int                                              AS total,
         COUNT(*) FILTER (WHERE acknowledged = FALSE)::int          AS unacknowledged,
         COUNT(*) FILTER (WHERE acknowledged = FALSE AND severity = 'HIGH')::int AS unack_high
       FROM fraud_alerts`
    );

    res.json({
      alerts: result.rows,
      summary: counts.rows[0],
      pagination: { limit, offset, count: result.rows.length },
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/fraud-alerts/:id/acknowledge
 */
router.post('/fraud-alerts/:id/acknowledge', authAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE fraud_alerts
          SET acknowledged = TRUE,
              acknowledged_by = $1,
              acknowledged_at = NOW()
        WHERE id = $2 AND acknowledged = FALSE
        RETURNING id, alert_type, severity, acknowledged, acknowledged_at`,
      [req.adminId, req.params.id]
    );

    if (result.rowCount === 0) {
      // Either not found or already acknowledged — disambiguate.
      const exists = await db.query('SELECT acknowledged FROM fraud_alerts WHERE id = $1', [req.params.id]);
      if (exists.rowCount === 0) return res.status(404).json({ error: 'Fraud alert not found' });
      return res.status(409).json({ error: 'Fraud alert already acknowledged' });
    }

    await auditLogService.logAdminAction(req.adminId, 'fraud_alert_acknowledge', {
      alert_id: req.params.id,
      alert_type: result.rows[0].alert_type,
      severity: result.rows[0].severity,
    });

    logger.info(`[Admin] Fraud alert ${req.params.id} acknowledged by admin ${req.adminId}`);
    res.json({ success: true, alert: result.rows[0] });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
 *  KYC SUBMISSIONS ENDPOINTS
 *  Review user identity submissions and, on approval, raise the
 *  user's kyc_level + daily_limit_ugx (both limit-enforcement paths).
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/kyc-submissions
 * Query: status (PENDING|APPROVED|REJECTED), limit, offset
 */
router.get('/kyc-submissions', authAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [];
    const params = [];
    if (status) {
      params.push(String(status).toUpperCase());
      conditions.push(`k.status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const result = await db.query(
      `SELECT k.id, k.user_id, k.requested_level, k.full_name, k.date_of_birth,
              k.document_type, k.document_number, k.document_country,
              k.document_front_url, k.document_back_url, k.selfie_url,
              k.status, k.review_notes, k.reviewed_by, k.reviewed_at, k.created_at,
              u.email       AS user_email,
              u.kyc_level   AS user_current_level,
              u.stellar_address AS user_stellar
         FROM kyc_submissions k
         LEFT JOIN users u ON u.id = k.user_id
         ${where}
         ORDER BY k.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const counts = await db.query(
      `SELECT
         COUNT(*)::int                                     AS total,
         COUNT(*) FILTER (WHERE status = 'PENDING')::int   AS pending,
         COUNT(*) FILTER (WHERE status = 'APPROVED')::int  AS approved,
         COUNT(*) FILTER (WHERE status = 'REJECTED')::int  AS rejected
       FROM kyc_submissions`
    );

    // Resolve private storage keys -> time-limited signed URLs for review.
    const { default: storageService } = await import('../services/storageService.js');
    const resolveDoc = async (val) => {
      if (!val) return null;
      if (/^https?:\/\//i.test(val)) return val; // legacy absolute URL
      const signed = await storageService.getSignedUrl(val);
      return signed?.url || null;
    };
    const submissions = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        document_front_url: await resolveDoc(row.document_front_url),
        document_back_url: await resolveDoc(row.document_back_url),
        selfie_url: await resolveDoc(row.selfie_url),
      }))
    );

    res.json({
      submissions,
      summary: counts.rows[0],
      pagination: { limit, offset, count: result.rows.length },
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/kyc-submissions/:id/approve
 * Approves the submission and raises the user's kyc_level + daily_limit_ugx.
 */
router.post('/kyc-submissions/:id/approve', authAdmin, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const subRes = await client.query(
      `SELECT id, user_id, requested_level, status, full_name, date_of_birth, document_country
         FROM kyc_submissions WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (subRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'KYC submission not found' });
    }
    const sub = subRes.rows[0];
    if (sub.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Submission already ${sub.status.toLowerCase()}` });
    }

    // [AML] Sanctions screening before we upgrade the user. A hit blocks approval
    // unless the admin explicitly overrides it as a false positive with a reason.
    const override = req.body?.override === true;
    const overrideReason = (req.body?.override_reason || '').trim();
    let screen = null;
    try {
      screen = await sanctionsService.screen({
        name: sub.full_name,
        dob: sub.date_of_birth ? String(sub.date_of_birth).slice(0, 10) : null,
        country: sub.document_country || null,
        subjectType: 'KYC',
        subjectRef: sub.id,
        userId: sub.user_id,
      });
    } catch (screenErr) {
      await client.query('ROLLBACK');
      logger.error('[Admin] KYC sanctions screening error:', screenErr.message);
      return res.status(503).json({ error: 'Compliance screening unavailable. Approval blocked.', code: 'SCREENING_UNAVAILABLE' });
    }

    if (screen.match && !override) {
      await client.query('ROLLBACK');
      await fraudMonitor.logAlert(
        sub.user_id,
        'SANCTIONS_HIT',
        `KYC applicant "${sub.full_name}" matched sanctioned entity "${screen.matchedName}" [${screen.matchedSource}] score ${screen.score}`
      );
      return res.status(409).json({
        error: 'Sanctions screening returned a potential match. Review and override with a reason to proceed.',
        code: 'SANCTIONS_HIT',
        screening: {
          check_id: screen.checkId,
          score: screen.score,
          matched_name: screen.matchedName,
          matched_source: screen.matchedSource,
          threshold: screen.threshold,
        },
      });
    }

    if (screen.match && override) {
      if (!overrideReason) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'override_reason is required to override a sanctions hit' });
      }
      if (screen.checkId) {
        try { await sanctionsService.recordOverride(screen.checkId, req.adminId, overrideReason); }
        catch (e) { logger.warn('[Admin] Failed to record screening override', { error: e.message }); }
      }
    }

    const level = sub.requested_level;
    const tier = config.kycLimits[level] || config.kycLimits.NONE;

    await client.query(
      `UPDATE kyc_submissions
          SET status = 'APPROVED', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $2`,
      [req.adminId, sub.id]
    );

    await client.query(
      `UPDATE users SET kyc_level = $1, daily_limit_ugx = $2, updated_at = NOW() WHERE id = $3`,
      [level, tier.daily, sub.user_id]
    );

    await client.query('COMMIT');

    await auditLogService.logAdminAction(req.adminId, 'kyc_approve', {
      submission_id: sub.id,
      user_id: sub.user_id,
      new_level: level,
      daily_limit_ugx: tier.daily,
      sanctions_screen: screen ? { result: screen.result, score: screen.score } : null,
      sanctions_override: screen?.match && override ? overrideReason : null,
    });

    try {
      await notificationService.notifyUser(sub.user_id, 'KYC_APPROVED', {
        message: `Your identity verification was approved. You are now ${level}.`,
      });
    } catch { /* notification failure must not block approval */ }

    logger.info(`[Admin] KYC submission ${sub.id} approved -> ${level} by admin ${req.adminId}`);
    res.json({ success: true, user_id: sub.user_id, new_level: level, daily_limit_ugx: tier.daily });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    next(err);
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/admin/kyc-submissions/:id/reject
 * Body: { reason }
 */
router.post('/kyc-submissions/:id/reject', authAdmin, async (req, res, next) => {
  try {
    const reason = (req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'reason is required' });

    const result = await db.query(
      `UPDATE kyc_submissions
          SET status = 'REJECTED', review_notes = $1, reviewed_by = $2,
              reviewed_at = NOW(), updated_at = NOW()
        WHERE id = $3 AND status = 'PENDING'
        RETURNING id, user_id, requested_level`,
      [reason, req.adminId, req.params.id]
    );

    if (result.rowCount === 0) {
      const exists = await db.query('SELECT status FROM kyc_submissions WHERE id = $1', [req.params.id]);
      if (exists.rowCount === 0) return res.status(404).json({ error: 'KYC submission not found' });
      return res.status(409).json({ error: `Submission already ${exists.rows[0].status.toLowerCase()}` });
    }

    await auditLogService.logAdminAction(req.adminId, 'kyc_reject', {
      submission_id: req.params.id,
      user_id: result.rows[0].user_id,
      reason,
    });

    try {
      await notificationService.notifyUser(result.rows[0].user_id, 'KYC_REJECTED', {
        message: `Your identity verification was not approved. Reason: ${reason}`,
      });
    } catch { /* notification failure must not block rejection */ }

    logger.info(`[Admin] KYC submission ${req.params.id} rejected by admin ${req.adminId}`);
    res.json({ success: true, submission: result.rows[0] });
  } catch (err) { next(err); }
});

/* ═══════════════════════════════════════════════════════════
 *  SANCTIONS / PEP SCREENING ENDPOINTS
 * ═══════════════════════════════════════════════════════════ */

/**
 * POST /api/v1/admin/screening/check
 * Ad-hoc screen of a name. Body: { name, dob?, country? }
 */
router.post('/screening/check', authAdmin, async (req, res, next) => {
  try {
    const { name, dob, country } = req.body || {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = await sanctionsService.screen({
      name: String(name).trim(),
      dob: dob || null,
      country: country || null,
      subjectType: 'MANUAL',
      userId: null,
    });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/screening/checks
 * Query: result (HIT|CLEAR), subject_type, limit, offset
 */
router.get('/screening/checks', authAdmin, async (req, res, next) => {
  try {
    const { result: resultFilter, subject_type } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [];
    const params = [];
    if (resultFilter === 'HIT' || resultFilter === 'CLEAR') {
      params.push(resultFilter);
      conditions.push(`result = $${params.length}`);
    }
    if (subject_type) {
      params.push(String(subject_type).toUpperCase());
      conditions.push(`subject_type = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rows = await db.query(
      `SELECT id, subject_type, subject_ref, user_id, query_name, query_dob, query_country,
              result, top_score, matched_name, matched_source, decision, override_reason, created_at
         FROM screening_checks ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );
    const counts = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE result = 'HIT')::int AS hits
         FROM screening_checks`
    );
    res.json({ checks: rows.rows, summary: counts.rows[0], pagination: { limit, offset, count: rows.rows.length } });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/sanctions
 * List the internal blocklist. Query: q (name search), limit, offset
 */
router.get('/sanctions', authAdmin, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [`source = 'INTERNAL'`, `is_active = TRUE`];
    const params = [];
    if (q) {
      params.push(`%${sanctionsService.normalizeName(q)}%`);
      conditions.push(`normalized_name LIKE $${params.length}`);
    }
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rows = await db.query(
      `SELECT id, entity_type, full_name, aliases, programs, countries, dob, remarks, created_at
         FROM sanctioned_entities
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const totals = await db.query(
      `SELECT source, COUNT(*)::int AS count
         FROM sanctioned_entities WHERE is_active = TRUE GROUP BY source`
    );
    const bySource = {};
    for (const r of totals.rows) bySource[r.source] = r.count;

    res.json({ entities: rows.rows, by_source: bySource });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/sanctions
 * Add an entity to the internal blocklist.
 * Body: { full_name, entity_type?, aliases?, programs?, countries?, dob?, remarks? }
 */
router.post('/sanctions', authAdmin, async (req, res, next) => {
  try {
    const { full_name, entity_type, aliases, programs, countries, dob, remarks } = req.body || {};
    if (!full_name || String(full_name).trim().length < 2) {
      return res.status(400).json({ error: 'full_name is required' });
    }
    const entity = await sanctionsService.addInternalEntity({
      fullName: String(full_name).trim(),
      entityType: entity_type || 'INDIVIDUAL',
      aliases: Array.isArray(aliases) ? aliases : [],
      programs: Array.isArray(programs) ? programs : [],
      countries: Array.isArray(countries) ? countries : [],
      dob: dob || null,
      remarks: remarks || null,
      addedBy: req.adminId,
    });
    await auditLogService.logAdminAction(req.adminId, 'sanctions_add', { entity_id: entity.id, full_name: entity.full_name });
    res.status(201).json({ success: true, entity });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/v1/admin/sanctions/:id
 * Deactivate an internal blocklist entry.
 */
router.delete('/sanctions/:id', authAdmin, async (req, res, next) => {
  try {
    const removed = await sanctionsService.deactivateEntity(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Internal sanctions entry not found' });
    await auditLogService.logAdminAction(req.adminId, 'sanctions_remove', { entity_id: req.params.id });
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

    // [PHASE 2C] Surface live rate/liquidity posture alongside trader rates so ops
    // can see whether quotes are coming from real liquidity or fallback.
    let liquidity = null;
    try { liquidity = await healthService.getLiquidityHealth(); }
    catch (e) { liquidity = { warningLevel: 'CRITICAL', criticals: ['health check failed: ' + e.message] }; }

    res.json({
      avg_rate_ugx: parseFloat(row.avg_rate_ugx) || 0,
      min_rate_ugx: parseFloat(row.min_rate_ugx) || 0,
      max_rate_ugx: parseFloat(row.max_rate_ugx) || 0,
      quote_source: liquidity?.quoteSource || 'UNKNOWN',
      path_discovery_available: liquidity?.pathDiscovery?.available ?? null,
      fallback_quotes_allowed: liquidity?.fallbackQuotesAllowed ?? null,
      market_maker_configured: liquidity?.marketMaker?.configured ?? null,
      escrow_usdc_balance: liquidity?.escrow?.usdc_balance ?? null,
      escrow_xlm_balance: liquidity?.escrow?.xlm_balance ?? null,
      pending_refunds: liquidity?.pending?.dispute_refund_pending ?? null,
      release_blocked: liquidity?.pending?.release_blocked ?? null,
      recent_failed: liquidity?.pending?.recent_failed ?? null,
      liquidity_warning_level: liquidity?.warningLevel || 'OK',
      liquidity_warnings: liquidity?.warnings || [],
      fiat_fx: liquidity?.fiatFx ?? null,
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
 * [PHASE 2H] Blocked — must use escrow-integrated refund paths.
 */
router.post('/transactions/:id/force-refund', authAdmin, async (req, res, next) => {
  try {
    await auditLogService.log({
      actor_role: 'admin',
      actor_id: req.adminId,
      action: 'dangerous_endpoint_blocked',
      resource_type: 'transaction',
      resource_id: req.params.id,
      metadata: {
        endpoint: 'POST /admin/transactions/:id/force-refund',
        reason: req.body?.reason || null,
        redirect: 'POST /admin/escrow/refund-retry/:transactionId or dispute resolve_user',
      },
    });
    return res.status(409).json({
      error: 'Force refund disabled',
      message: 'Cannot mark REFUNDED without an on-chain refund. Use POST /api/v1/admin/escrow/refund-retry/:transactionId or resolve the dispute for the user via POST /api/v1/admin/disputes/:id/resolve.',
      useInstead: [
        'POST /api/v1/admin/escrow/refund-retry/:transactionId',
        'POST /api/v1/admin/disputes/:id/resolve (resolution: RESOLVED_FOR_USER)',
      ],
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/transactions/:id/force-complete
 * [PHASE 2H] Blocked — must use escrow-integrated release paths.
 */
router.post('/transactions/:id/force-complete', authAdmin, async (req, res, next) => {
  try {
    await auditLogService.log({
      actor_role: 'admin',
      actor_id: req.adminId,
      action: 'dangerous_endpoint_blocked',
      resource_type: 'transaction',
      resource_id: req.params.id,
      metadata: {
        endpoint: 'POST /admin/transactions/:id/force-complete',
        reason: req.body?.reason || null,
        redirect: 'POST /admin/disputes/:id/resolve (resolve_trader) or user confirm-receipt flow',
      },
    });
    return res.status(409).json({
      error: 'Force complete disabled',
      message: 'Cannot mark COMPLETE without an on-chain USDC release. Use the normal release flow or POST /api/v1/admin/disputes/:id/resolve with resolution RESOLVED_FOR_TRADER.',
      useInstead: 'POST /api/v1/admin/disputes/:id/resolve (resolution: RESOLVED_FOR_TRADER)',
    });
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
    const dispute = await disputeService.getDisputeById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    res.json({ dispute });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/disputes/:disputeId/evidence
 */
router.get('/disputes/:disputeId/evidence', authAdmin, async (req, res, next) => {
  try {
    const { default: disputeEvidenceService } = await import('../services/disputeEvidenceService.js');
    const evidence = await disputeEvidenceService.listEvidence(req.params.disputeId, { admin: true });
    res.json({ evidence });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/admin/disputes/:id/resolve
 *
 * P0.7: This previously did a DB-only status UPDATE and never touched escrow,
 * so resolving a dispute moved no money. It now delegates to the
 * escrow-integrated disputeService.adminAction:
 *   - RESOLVED_FOR_TRADER → transitions tx to DISPUTE_RELEASE_PENDING and
 *     enqueues the USDC release to the partner.
 *   - RESOLVED_FOR_USER   → transitions tx to DISPUTE_REFUND_PENDING and
 *     enqueues the refund resolution (see refund job for pending behaviour).
 *   - DISMISSED           → closes the dispute without moving funds.
 *
 * Body: { resolution: 'RESOLVED_FOR_USER'|'RESOLVED_FOR_TRADER'|'DISMISSED'|'refund'|'release'|'dismiss', adminNotes }
 */
router.post('/disputes/:id/resolve', authAdmin, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const { resolution, adminNotes } = req.body;
    if (!resolution) return res.status(400).json({ error: 'resolution is required' });

    // Map the admin-console resolution value to a disputeService action.
    const actionMap = {
      RESOLVED_FOR_USER: 'resolve_user',
      refund: 'resolve_user',
      RESOLVED_FOR_TRADER: 'resolve_trader',
      release: 'resolve_trader',
      DISMISSED: 'dismiss',
      dismiss: 'dismiss',
    };
    const action = actionMap[resolution];
    if (!action) {
      return res.status(400).json({ error: `Unsupported resolution: ${resolution}` });
    }

    const dispute = await disputeService.adminAction(req.params.id, req.adminId, action, {
      reason: adminNotes || resolution,
      internalNote: adminNotes,
    });

    logger.info(`[Admin] Dispute ${req.params.id} resolved via escrow-integrated action: ${action}`);
    res.json({ success: true, disputeId: req.params.id, resolution: dispute.status, dispute });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/admin/transactions/:id/retry-refund
 *
 * [PHASE 2B] Retry the on-chain USDC refund for a user-win dispute that is stuck
 * in DISPUTE_REFUND_PENDING (e.g. the user has since added a USDC trustline).
 * Idempotent + fully self-guarded by escrowController.refundToUser.
 *
 * Responses:
 *   200 { status: 'refunded', refundHash }          — refund completed
 *   200 { status: 'already_refunded', refundHash }  — was already refunded (no-op)
 *   200 { status: 'blocked' | 'failed', code, message } — still pending, retry later
 *   409 { error }                                   — invalid (already released / wrong state)
 */
router.post('/transactions/:id/retry-refund', authAdmin, async (req, res, next) => {
  try {
    const result = await escrowController.refundToUser(req.params.id, {
      adminId: req.adminId,
      retry: true,
    });
    logger.info(`[Admin] retry-refund tx ${req.params.id} by ${req.adminId} → ${result.status}${result.code ? '/' + result.code : ''}`);
    return res.json({ success: result.status === 'refunded' || result.status === 'already_refunded', ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/admin/disputes/:id/retry-refund
 * [PHASE 2B] Convenience alias — resolves the dispute's transaction then retries
 * the refund, so the admin console can retry from a dispute context too.
 */
router.post('/disputes/:id/retry-refund', authAdmin, async (req, res, next) => {
  try {
    const d = await db.query(`SELECT transaction_id FROM disputes WHERE id = $1`, [req.params.id]);
    if (!d.rows[0]) return res.status(404).json({ error: 'Dispute not found' });
    const result = await escrowController.refundToUser(d.rows[0].transaction_id, {
      adminId: req.adminId,
      retry: true,
    });
    logger.info(`[Admin] retry-refund dispute ${req.params.id} (tx ${d.rows[0].transaction_id}) by ${req.adminId} → ${result.status}`);
    return res.json({ success: result.status === 'refunded' || result.status === 'already_refunded', ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/admin/disputes/:id/escalate
 */
router.post('/disputes/:id/escalate', authAdmin, async (req, res, next) => {
  try {
    const { reason } = req.body;
    // Delegate to the dispute service so escalation is consistent with the rest
    // of the workflow: status → ESCALATED (not UNDER_REVIEW), escalated_by/at/reason
    // recorded, audit-logged, and admins notified. The priority engine keys high
    // priority off ESCALATED, so the raw-SQL UNDER_REVIEW path used to mis-rank it.
    const dispute = await disputeService.adminAction(req.params.id, req.adminId, 'escalate', {
      reason: reason || 'No reason provided',
    });
    logger.info(`[Admin] Dispute ${req.params.id} escalated by ${req.adminId}: ${reason || 'No reason provided'}`);
    res.json({ success: true, disputeId: req.params.id, status: dispute.status });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
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

/* ═══════════════════════════════════════════════════════════
 *  USER MANAGEMENT ENDPOINTS
 *  Ops needs to inspect and freeze wallet users (e.g. after a
 *  sanctions/fraud hit). Freezing sets is_active = FALSE which
 *  blocks the user's session (auth) AND their transactions (fraudMonitor).
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/v1/admin/users
 * Query: q (id/stellar/email search), status (active|frozen), kyc_level, limit, offset
 */
router.get('/users', authAdmin, async (req, res, next) => {
  try {
    const { q, status, kyc_level } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const conditions = [`role = 'user'`];
    const params = [];
    if (q) {
      params.push(`%${q.trim()}%`);
      conditions.push(`(id::text ILIKE $${params.length} OR stellar_address ILIKE $${params.length} OR COALESCE(email,'') ILIKE $${params.length})`);
    }
    if (status === 'active') conditions.push(`is_active = TRUE`);
    if (status === 'frozen') conditions.push(`is_active = FALSE`);
    if (kyc_level) {
      params.push(String(kyc_level).toUpperCase());
      conditions.push(`kyc_level = $${params.length}`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rows = await db.query(
      `SELECT id, stellar_address, email, kyc_level, daily_limit_ugx, is_active, created_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    const counts = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE is_active = FALSE)::int AS frozen
         FROM users WHERE role = 'user'`
    );

    res.json({ users: rows.rows, summary: counts.rows[0], pagination: { limit, offset, count: rows.rows.length } });
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/admin/users/:id
 * User detail + recent risk signals.
 */
router.get('/users/:id', authAdmin, async (req, res, next) => {
  try {
    const userRes = await db.query(
      `SELECT id, stellar_address, email, kyc_level, daily_limit, per_tx_limit,
              daily_limit_ugx, is_active, device_id, created_at, updated_at
         FROM users WHERE id = $1 AND role = 'user'`,
      [req.params.id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const [txCount, alerts, screens, kyc] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS c FROM transactions WHERE user_id = $1`, [req.params.id]),
      db.query(
        `SELECT id, alert_type, severity, details, acknowledged, created_at
           FROM fraud_alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [req.params.id]
      ),
      db.query(
        `SELECT id, subject_type, query_name, result, top_score, matched_name, created_at
           FROM screening_checks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [req.params.id]
      ),
      db.query(
        `SELECT id, requested_level, status, created_at FROM kyc_submissions
          WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [req.params.id]
      ),
    ]);

    res.json({
      user: userRes.rows[0],
      transaction_count: txCount.rows[0].c,
      recent_fraud_alerts: alerts.rows,
      recent_screening_checks: screens.rows,
      latest_kyc_submission: kyc.rows[0] || null,
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/users/:id/freeze
 * Body: { reason }
 */
router.post('/users/:id/freeze', authAdmin, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const reason = (req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'reason is required' });

    const result = await db.query(
      `UPDATE users SET is_active = FALSE, updated_at = NOW()
        WHERE id = $1 AND role = 'user' AND is_active = TRUE
        RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      const exists = await db.query(`SELECT is_active FROM users WHERE id = $1 AND role = 'user'`, [req.params.id]);
      if (exists.rowCount === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(409).json({ error: 'User is already frozen' });
    }

    await auditLogService.logAdminAction(req.adminId, 'user_freeze', { user_id: req.params.id, reason });
    logger.info(`[Admin] User ${req.params.id} frozen by admin ${req.adminId}: ${reason}`);
    res.json({ success: true, id: req.params.id, is_active: false });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/admin/users/:id/unfreeze
 */
router.post('/users/:id/unfreeze', authAdmin, sensitiveActionLimiter, async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE users SET is_active = TRUE, updated_at = NOW()
        WHERE id = $1 AND role = 'user' AND is_active = FALSE
        RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      const exists = await db.query(`SELECT is_active FROM users WHERE id = $1 AND role = 'user'`, [req.params.id]);
      if (exists.rowCount === 0) return res.status(404).json({ error: 'User not found' });
      return res.status(409).json({ error: 'User is already active' });
    }

    await auditLogService.logAdminAction(req.adminId, 'user_unfreeze', { user_id: req.params.id });
    logger.info(`[Admin] User ${req.params.id} unfrozen by admin ${req.adminId}`);
    res.json({ success: true, id: req.params.id, is_active: true });
  } catch (err) { next(err); }
});

export default router;