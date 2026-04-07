import { Router } from 'express';
import { authUser, authTrader, authAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import multer from 'multer';
import disputeService from '../services/disputeService.js';
import notificationService from '../services/notificationService.js';
import auditLogService from '../services/auditLogService.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

/**
 * ────────────────────────────────────────────────────────────
 * USER ROUTES (wallet users creating disputes)
 * ────────────────────────────────────────────────────────────
 */

/**
 * POST /api/v1/disputes
 * User creates a dispute for a completed transaction
 *
 * Body: { transactionId, reason }
 */
router.post(
  '/',
  authUser,
  validate(['transactionId', 'reason']),
  async (req, res, next) => {
    try {
      const { transactionId, reason } = req.body;
      const userId = req.userId;

      // Verify transaction exists and belongs to user
      const txResult = await db.query(
        `SELECT id, trader_id FROM transactions WHERE id = $1 AND user_id = $2`,
        [transactionId, userId]
      );
      const tx = txResult.rows[0];
      if (!tx) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const dispute = await disputeService.createDispute(
        transactionId,
        userId,
        tx.trader_id,
        reason
      );

      res.status(201).json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/disputes
 * List user's disputes
 */
router.get(
  '/',
  authUser,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const { status, limit = 50, offset = 0 } = req.query;

      const disputes = await disputeService.listDisputes({
        userId,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({ disputes });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/disputes/:id
 * Get dispute detail (user or trader view)
 */
router.get(
  '/:id',
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.userId || req.traderId; // User or Trader
      const role = req.userId ? 'user' : 'trader';

      const dispute = await disputeService.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      // Verify access
      if (role === 'user' && dispute.user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to view this dispute' });
      }
      if (role === 'trader' && dispute.trader_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to view this dispute' });
      }

      res.json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * ────────────────────────────────────────────────────────────
 * TRADER ROUTES (responding to disputes)
 * ────────────────────────────────────────────────────────────
 */

/**
 * GET /api/v1/trader/disputes
 * List trader's disputes
 */
router.get(
  '/trader/disputes',
  authTrader,
  async (req, res, next) => {
    try {
      const traderId = req.traderId;
      const { status, limit = 50, offset = 0 } = req.query;

      const disputes = await disputeService.listDisputes({
        traderId,
        status,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({ disputes });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/trader/disputes/:id
 * Get dispute detail for trader
 */
router.get(
  '/trader/disputes/:id',
  authTrader,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const traderId = req.traderId;

      const dispute = await disputeService.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }
      if (dispute.trader_id !== traderId) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      res.json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/disputes/:id/respond
 * Trader submits response and optional proof
 *
 * multipart/form-data:
 *   - responseText (required)
 *   - paymentProof (optional, file)
 */
router.post(
  '/trader/disputes/:id/respond',
  authTrader,
  upload.single('paymentProof'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const traderId = req.traderId;
      const { responseText } = req.body;

      if (!responseText || !responseText.trim()) {
        return res.status(400).json({ error: 'Response text is required' });
      }

      const dispute = await disputeService.traderRespond(
        id,
        traderId,
        responseText.trim(),
        req.file
      );

      res.json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * ────────────────────────────────────────────────────────────
 * ADMIN ROUTES (dispute resolution)
 * ────────────────────────────────────────────────────────────
 */

/**
 * GET /api/v1/admin/disputes
 * List all disputes with filtering
 */
router.get(
  '/admin/disputes',
  authAdmin,
  async (req, res, next) => {
    try {
      const { status, traderId, userId, limit = 50, offset = 0 } = req.query;

      const disputes = await disputeService.listDisputes({
        status,
        traderId,
        userId,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Get count
      let countQuery = 'SELECT COUNT(*) as count FROM disputes WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (status) {
        countQuery += ` AND status = $${paramCount++}`;
        params.push(status);
      }
      if (traderId) {
        countQuery += ` AND trader_id = $${paramCount++}`;
        params.push(traderId);
      }
      if (userId) {
        countQuery += ` AND user_id = $${paramCount++}`;
        params.push(userId);
      }

      const countResult = await db.query(countQuery, params);
      const total = parseInt(countResult.rows[0]?.count || 0);

      res.json({
        disputes,
        total,
        page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        pages: Math.ceil(total / parseInt(limit)),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/disputes/:id
 * Get dispute detail for admin
 */
router.get(
  '/admin/disputes/:id',
  authAdmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const dispute = await disputeService.getDisputeById(id);
      if (!dispute) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      res.json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/disputes/:id/action
 * Admin takes resolution action
 *
 * Body: {
 *   action: 'resolve_user'|'resolve_trader'|'escalate'|'request_evidence'|'dismiss'|'close',
 *   reason: string,
 *   internalNote?: string
 * }
 */
router.post(
  '/admin/disputes/:id/action',
  authAdmin,
  validate(['action', 'reason']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.adminId;
      const { action, reason, internalNote } = req.body;

      const dispute = await disputeService.adminAction(
        id,
        adminId,
        action,
        { reason, internalNote }
      );

      res.json({ dispute });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/admin/disputes/:id/evidence
 * Admin adds internal evidence note
 */
router.post(
  '/admin/disputes/:id/evidence',
  authAdmin,
  validate(['note']),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const adminId = req.adminId;
      const { note } = req.body;

      const result = await db.query(
        `UPDATE disputes SET admin_notes = CONCAT(COALESCE(admin_notes, ''), '\n[Admin ' || $1 || ']: ' || $2)
         WHERE id = $3
         RETURNING *`,
        [new Date().toISOString(), note, id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Dispute not found' });
      }

      // Log
      await auditLogService.log({
        admin_id: adminId,
        actor_role: 'admin',
        action: 'dispute_evidence_added',
        resource_type: 'dispute',
        resource_id: id,
        metadata: { note },
      });

      res.json({ dispute: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/admin/audit-logs
 * View audit logs (disputes and admin actions)
 */
router.get(
  '/admin/audit-logs',
  authAdmin,
  async (req, res, next) => {
    try {
      const { action, resource_type, search, date_from, page = 1, limit = 50 } = req.query;

      const result = await auditLogService.getAuditLogs({
        page: parseInt(page),
        limint: parseInt(limit),
        action,
        resource_type,
        search,
        date_from,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
