import db from '../db/index.js';
import redis from '../db/redis.js';
import logger from '../utils/logger.js';
import storageService from './storageService.js';
import notificationService from './notificationService.js';
import auditLogService from './auditLogService.js';
import stateMachine from './transactionStateMachine.js';

/**
 * DisputeService — Handles all dispute workflow operations
 *
 * Lifecycle:
 *   OPEN → TRADER_RESPONDED → UNDER_REVIEW → [RESOLVED_FOR_USER|RESOLVED_FOR_TRADER|ESCALATED] → CLOSED
 *
 * Valid transitions:
 *   OPEN: → TRADER_RESPONDED, UNDER_REVIEW, DISMISSED, CLOSED
 *   TRADER_RESPONDED: → UNDER_REVIEW, DISMISSED, CLOSED
 *   UNDER_REVIEW: → RESOLVED_FOR_USER, RESOLVED_FOR_TRADER, ESCALATED, DISMISSED, CLOSED
 *   ESCALATED: → RESOLVED_FOR_USER, RESOLVED_FOR_TRADER, DISMISSED, CLOSED
 *   RESOLVED_FOR_USER: → CLOSED
 *   RESOLVED_FOR_TRADER: → CLOSED
 *   DISMISSED: → CLOSED
 */

const VALID_TRANSITIONS = {
  // Admins may resolve directly from OPEN / TRADER_RESPONDED (no mandatory
  // UNDER_REVIEW step) so the escrow-integrated resolution path is reachable.
  OPEN: ['TRADER_RESPONDED', 'UNDER_REVIEW', 'RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED', 'ESCALATED', 'CLOSED'],
  TRADER_RESPONDED: ['UNDER_REVIEW', 'RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED', 'CLOSED', 'ESCALATED'],
  UNDER_REVIEW: ['RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'ESCALATED', 'DISMISSED', 'CLOSED'],
  ESCALATED: ['RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED', 'CLOSED'],
  RESOLVED_FOR_USER: ['CLOSED'],
  RESOLVED_FOR_TRADER: ['CLOSED'],
  DISMISSED: ['CLOSED'],
  CLOSED: [],  // terminal
};

/**
 * Create a new dispute
 *
 * @param {string} transactionId - transaction that is disputed
 * @param {string} userId - user filing the dispute
 * @param {string} traderId - trader being disputed
 * @param {string} reason - dispute reason/claim
 * @returns {object} created dispute
 */
async function createDispute(transactionId, userId, traderId, reason) {
  // 1. Verify transaction exists and belongs to correct parties
  const txResult = await db.query(
    `SELECT id, user_id, trader_id, state, fiat_amount, fiat_currency, network
     FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = txResult.rows[0];
  if (!tx) throw new Error('Transaction not found');
  if (tx.user_id !== userId) throw new Error('Transaction does not belong to this user');
  if (tx.trader_id !== traderId) throw new Error('Transaction does not belong to this trader');

  // 1b. Disputable states: active payout flow OR completed within appeal window.
  const DISPUTABLE_STATES = ['FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING', 'COMPLETE'];
  if (!DISPUTABLE_STATES.includes(tx.state)) {
    const err = new Error(
      `Cannot open a dispute in state ${tx.state}. A dispute can only be opened after the partner has submitted the mobile money payout and before the cash-out is settled.`
    );
    err.statusCode = 409;
    throw err;
  }

  if (tx.state === 'COMPLETE') {
    const appealCheck = await db.query(
      `SELECT appeal_expires_at, appeal_archived_at FROM transactions WHERE id = $1`,
      [transactionId]
    );
    const appeal = appealCheck.rows[0] || {};
    if (appeal.appeal_archived_at) {
      const err = new Error('The appeal window for this order has closed.');
      err.statusCode = 409;
      throw err;
    }
    if (appeal.appeal_expires_at && new Date(appeal.appeal_expires_at) < new Date()) {
      const err = new Error('The appeal window for this order has closed.');
      err.statusCode = 409;
      throw err;
    }
  }

  // 2. Check if dispute already exists
  const existingResult = await db.query(
    `SELECT id FROM disputes WHERE transaction_id = $1 AND status NOT IN ('CLOSED', 'DISMISSED')`,
    [transactionId]
  );
  if (existingResult.rows.length > 0) {
    const err = new Error('A dispute is already open for this transaction');
    err.statusCode = 409;
    throw err;
  }

  // 3. Create dispute with SLA deadline (48 hours)
  const slaDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const disputeResult = await db.query(
    `INSERT INTO disputes (transaction_id, user_id, trader_id, reason, status, sla_deadline)
     VALUES ($1, $2, $3, $4, 'OPEN', $5)
     RETURNING *`,
    [transactionId, userId, traderId, reason, slaDeadline]
  );
  const dispute = disputeResult.rows[0];

  // 4. Move the transaction into DISPUTE_OPENED and link the dispute.
  // Escrow stays locked because no release/refund runs until an admin resolves.
  // The state-machine guard (fromState = tx.state) makes this safe against races.
  const moved = await stateMachine.transition(transactionId, tx.state, 'DISPUTE_OPENED', {
    dispute_id: dispute.id,
    dispute_started_at: new Date(),
  });
  if (!moved) {
    // Transaction advanced concurrently — roll back the dispute row so we don't
    // leave an orphan OPEN dispute with no held escrow.
    await db.query(`DELETE FROM disputes WHERE id = $1`, [dispute.id]);
    const err = new Error('Transaction state changed before the dispute could be opened. Please retry.');
    err.statusCode = 409;
    throw err;
  }

  // 5. Log audit trail
  await auditLogService.log({
    actor_role: 'user',
    action: 'dispute_created',
    resource_type: 'dispute',
    resource_id: dispute.id,
    metadata: {
      transaction_id: transactionId,
      reason,
      user_id: userId,
      trader_id: traderId,
    },
  });

  try {
    const chatService = (await import('./chatService.js')).default;
    await chatService.sendSystemMessage(
      transactionId,
      'A dispute has been raised. Our support team will review your chat history.'
    );
  } catch (_) { /* best-effort */ }

  // 6. Notify trader
  await notificationService.notifyTrader(traderId, 'dispute_opened', {
    dispute_id: dispute.id,
    transaction_id: transactionId,
    user_claim: reason,
    response_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  const { formatShortId } = await import('../utils/shortId.js');
  const shortId = formatShortId(transactionId);

  notificationService.createNotification(
    userId,
    'user',
    'DISPUTE_OPENED',
    'Dispute opened',
    'Your dispute has been received. Our team will review within 24 hours.',
    transactionId
  ).catch(() => {});

  notificationService.createNotification(
    traderId,
    'trader',
    'DISPUTE_OPENED',
    'Dispute raised',
    `The buyer has raised a dispute on order ${shortId}. Please provide evidence.`,
    transactionId
  ).catch(() => {});

  // 7. Notify admin
  await notificationService.notifyAdmins('dispute_created', {
    dispute_id: dispute.id,
    transaction_id: transactionId,
    trader_id: traderId,
    user_id: userId,
    reason,
  });

  logger.info(`[Dispute] Created: ${dispute.id} for tx ${transactionId}`);
  return dispute;
}

/**
 * Trader responds to dispute with proof
 *
 * @param {string} disputeId - dispute being responded to
 * @param {string} traderId - trader responding
 * @param {string} responseText - trader's explanation
 * @param {object} proofFile - optional proof file (Buffer)
 * @returns {object} updated dispute
 */
async function traderRespond(disputeId, traderId, responseText, proofFile) {
  // 1. Fetch dispute
  const disputeResult = await db.query(
    `SELECT * FROM disputes WHERE id = $1`,
    [disputeId]
  );
  const dispute = disputeResult.rows[0];
  if (!dispute) throw new Error('Dispute not found');
  if (dispute.trader_id !== traderId) throw new Error('Dispute does not belong to this trader');
  if (dispute.status !== 'OPEN') throw new Error(`Cannot respond to ${dispute.status} dispute`);

  // 2. Check for duplicate responses (Redis lock)
  const lockKey = `lock:dispute_respond:${disputeId}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
  if (!lockAcquired) {
    throw new Error('Response already being processed');
  }

  try {
    let proofKey = null;

    // 3. Save proof file if provided
    if (proofFile) {
      proofKey = await storageService.saveFile(
        proofFile.buffer || proofFile,
        proofFile.originalname || `dispute_${disputeId}_proof.jpg`,
        traderId
      );
    }

    // 4. Update dispute
    const updateResult = await db.query(
      `UPDATE disputes 
       SET trader_response = $1, trader_response_at = NOW(), trader_proof_key = $2,
           status = 'TRADER_RESPONDED'
       WHERE id = $3 AND status = 'OPEN'
       RETURNING *`,
      [responseText, proofKey, disputeId]
    );

    if (!updateResult.rows[0]) {
      throw new Error('Dispute status changed during response');
    }

    const updatedDispute = updateResult.rows[0];

    // 5. Log audit trail
    await auditLogService.log({
      actor_role: 'trader',
      action: 'dispute_trader_responded',
      resource_type: 'dispute',
      resource_id: disputeId,
      metadata: {
        trader_id: traderId,
        response_length: responseText.length,
        has_proof: !!proofKey,
      },
    });

    // 6. Notify user and admins
    await notificationService.notifyUser(dispute.user_id, 'dispute_trader_responded', {
      dispute_id: disputeId,
      trader_response: responseText,
      has_proof: !!proofKey,
    });
    await notificationService.createNotification(
      dispute.user_id,
      'user',
      'dispute_update',
      'Trader responded to your dispute',
      'The trader added a response to your dispute. Our team is reviewing the case.',
      dispute.transaction_id
    ).catch(() => {});

    await notificationService.notifyAdmins('dispute_trader_responded', {
      dispute_id: disputeId,
      trader_id: traderId,
    });

    logger.info(`[Dispute] Trader ${traderId} responded to dispute ${disputeId}`);
    return updatedDispute;
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * Admin reviews dispute and takes action
 * Valid actions: resolve_user, resolve_trader, escalate, request_evidence, dismiss, close
 *
 * @param {string} disputeId - dispute being reviewed
 * @param {string} adminId - admin taking action
 * @param {string} action - resolution action
 * @param {object} actionData - { reason, internalNote, proofFile? }
 * @returns {object} updated dispute
 */
async function adminAction(disputeId, adminId, action, actionData = {}) {
  // 1. Fetch dispute
  const disputeResult = await db.query(
    `SELECT * FROM disputes WHERE id = $1`,
    [disputeId]
  );
  const dispute = disputeResult.rows[0];
  if (!dispute) throw new Error('Dispute not found');

  // 2. Validate action
  const validActions = ['resolve_user', 'resolve_trader', 'escalate', 'request_evidence', 'dismiss', 'close'];
  if (!validActions.includes(action)) throw new Error(`Invalid action: ${action}`);

  // 3. Check if action is allowed from current status
  let targetStatus;
  switch (action) {
    case 'resolve_user':
      targetStatus = 'RESOLVED_FOR_USER';
      if (!VALID_TRANSITIONS[dispute.status] || !VALID_TRANSITIONS[dispute.status].includes(targetStatus)) {
        // [B1-class FIX] Already-resolved / invalid status is a client conflict (409),
        // so a duplicate admin resolution returns a clean error instead of HTTP 500.
        const err = new Error(`Cannot resolve for user from ${dispute.status} status`);
        err.statusCode = 409;
        throw err;
      }
      break;
    case 'resolve_trader':
      targetStatus = 'RESOLVED_FOR_TRADER';
      if (!VALID_TRANSITIONS[dispute.status] || !VALID_TRANSITIONS[dispute.status].includes(targetStatus)) {
        const err = new Error(`Cannot resolve for trader from ${dispute.status} status`);
        err.statusCode = 409;
        throw err;
      }
      break;
    case 'escalate':
      targetStatus = 'ESCALATED';
      if (!VALID_TRANSITIONS[dispute.status] || !VALID_TRANSITIONS[dispute.status].includes(targetStatus)) {
        const err = new Error(`Cannot escalate from ${dispute.status} status`);
        err.statusCode = 409;
        throw err;
      }
      break;
    case 'request_evidence':
      // updates metadata, doesn't change status
      break;
    case 'dismiss':
      targetStatus = 'DISMISSED';
      if (!VALID_TRANSITIONS[dispute.status] || !VALID_TRANSITIONS[dispute.status].includes(targetStatus)) {
        const err = new Error(`Cannot dismiss from ${dispute.status} status`);
        err.statusCode = 409;
        throw err;
      }
      break;
    case 'close':
      // can close from terminal states
      targetStatus = 'CLOSED';
      break;
  }

  // 4. Update dispute
  let updates = {};
  let updateFields = [];
  let paramCount = 1;

  if (targetStatus) {
    updateFields.push(`status = $${paramCount++}`);
    updates.status = targetStatus;
  }

  if (actionData.internalNote) {
    updateFields.push(`admin_notes = $${paramCount++}`);
    updates.admin_notes = actionData.internalNote;
  }

  if (action === 'escalate') {
    updateFields.push(`escalated_by = $${paramCount++}`);
    updateFields.push(`escalated_at = NOW()`);
    updateFields.push(`escalation_reason = $${paramCount++}`);
    updates.escalated_by = adminId;
    updates.escalated_at = new Date();
    updates.escalation_reason = actionData.reason;
  }

  if (action.startsWith('resolve_')) {
    updateFields.push(`resolved_by = $${paramCount++}`);
    updateFields.push(`resolved_at = NOW()`);
    updateFields.push(`resolution_reason = $${paramCount++}`);
    updates.resolved_by = adminId;
    updates.resolved_at = new Date();
    updates.resolution_reason = actionData.reason;
  }

  if (action === 'dismiss') {
    updateFields.push(`closure_reason = $${paramCount++}`);
    updates.closure_reason = actionData.reason || 'Dismissed by admin';
  }

  // Build query with proper parameter handling
  const params = [];
  const paramMap = {};
  let finalParamCount = 1;

  if (targetStatus) {
    params.push(targetStatus);
    paramMap[finalParamCount] = true;
    finalParamCount++;
  }

  if (actionData.internalNote) {
    params.push(actionData.internalNote);
    paramMap[finalParamCount] = true;
    finalParamCount++;
  }

  if (action === 'escalate') {
    params.push(adminId);
    params.push(actionData.reason || '');
    paramMap[finalParamCount] = true;
    paramMap[finalParamCount + 1] = true;
    finalParamCount += 2;
  }

  if (action.startsWith('resolve_')) {
    params.push(adminId);
    params.push(actionData.reason || '');
    paramMap[finalParamCount] = true;
    paramMap[finalParamCount + 1] = true;
    finalParamCount += 2;
  }

  if (action === 'dismiss') {
    params.push(actionData.reason || 'Dismissed by admin');
    paramMap[finalParamCount] = true;
    finalParamCount++;
  }

  params.push(disputeId);

  const updateQuery = `
    UPDATE disputes 
    SET ${updateFields.join(', ')}
    WHERE id = $${finalParamCount}
    RETURNING *
  `;

  const updateResult = await db.query(updateQuery, params);
  const updatedDispute = updateResult.rows[0];

  // 5. Handle transaction state changes based on resolution
  if (action === 'resolve_user') {
    await stateMachine.transitionForDispute(dispute.transaction_id, 'DISPUTE_WON_USER', { dispute_id: disputeId });
    // Trigger refund flow
    const jobQueue = await import('./jobQueue.js').then(m => m.default);
    await jobQueue.enqueueDisputeRefund(dispute.transaction_id, dispute.user_id);
  } else if (action === 'resolve_trader') {
    await stateMachine.transitionForDispute(dispute.transaction_id, 'DISPUTE_WON_TRADER', { dispute_id: disputeId });
    // Trigger payout finalization
    const jobQueue = await import('./jobQueue.js').then(m => m.default);
    await jobQueue.enqueueDisputeRelease(dispute.transaction_id, dispute.trader_id);
  }

  // 6. Log audit trail (money-sensitive admin action)
  await auditLogService.log({
    admin_id: adminId,
    actor_role: 'admin',
    action: `dispute_${action}`,
    resource_type: 'dispute',
    resource_id: disputeId,
    old_value: { status: dispute.status },
    new_value: { status: targetStatus || dispute.status },
    metadata: {
      reason: actionData.reason,
      admin_id: adminId,
      transaction_id: dispute.transaction_id,
    },
  });

  // 7. Notify all parties
  if (action === 'resolve_user') {
    await notificationService.notifyUser(dispute.user_id, 'dispute_resolved_user_favour', {
      dispute_id: disputeId,
      reason: actionData.reason,
    });
    await notificationService.notifyTrader(dispute.trader_id, 'dispute_resolved_trader_unfavour', {
      dispute_id: disputeId,
      reason: actionData.reason,
    });
    notificationService.createNotification(
      dispute.user_id,
      'user',
      'DISPUTE_RESOLVED',
      'Dispute resolved',
      `Your dispute has been resolved. ${actionData.reason || 'Funds have been refunded to your wallet.'}`,
      dispute.transaction_id
    ).catch(() => {});
    notificationService.createNotification(
      dispute.trader_id,
      'trader',
      'DISPUTE_RESOLVED',
      'Dispute resolved',
      'The dispute on your order has been resolved.',
      dispute.transaction_id
    ).catch(() => {});
  } else if (action === 'resolve_trader') {
    await notificationService.notifyTrader(dispute.trader_id, 'dispute_resolved_trader_favour', {
      dispute_id: disputeId,
      reason: actionData.reason,
    });
    await notificationService.notifyUser(dispute.user_id, 'dispute_resolved_user_unfavour', {
      dispute_id: disputeId,
      reason: actionData.reason,
    });
    notificationService.createNotification(
      dispute.user_id,
      'user',
      'DISPUTE_RESOLVED',
      'Dispute resolved',
      `Your dispute has been resolved. ${actionData.reason || 'The trade was completed in favour of the trader.'}`,
      dispute.transaction_id
    ).catch(() => {});
    notificationService.createNotification(
      dispute.trader_id,
      'trader',
      'DISPUTE_RESOLVED',
      'Dispute resolved',
      'The dispute on your order has been resolved.',
      dispute.transaction_id
    ).catch(() => {});
  } else if (action === 'escalate') {
    await notificationService.notifyAdmins('dispute_escalated', {
      dispute_id: disputeId,
      reason: actionData.reason,
    });
  } else if (action === 'request_evidence') {
    await notificationService.notifyTrader(dispute.trader_id, 'dispute_evidence_requested', {
      dispute_id: disputeId,
      request: actionData.reason,
    });
    await notificationService.createNotification(
      dispute.trader_id,
      'trader',
      'dispute',
      'More evidence requested',
      actionData.reason || 'Support requested more evidence on this dispute.',
      dispute.transaction_id
    ).catch(() => {});
  }

  logger.info(`[Dispute] Admin ${adminId} took action ${action} on dispute ${disputeId}`);
  return updatedDispute;
}

function computeDisputePriority(dispute) {
  if (!dispute) return 'medium';

  if (['RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED', 'CLOSED'].includes(dispute.status)) {
    return 'resolved';
  }

  if (dispute.status === 'ESCALATED') {
    return 'high';
  }

  const deadline = dispute.sla_deadline ? new Date(dispute.sla_deadline) : null;
  if (deadline && !Number.isNaN(deadline.getTime())) {
    const hoursRemaining = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining <= 12) return 'high';
    if (hoursRemaining <= 24) return 'medium';
  }

  if (dispute.status === 'OPEN') return 'medium';
  if (dispute.status === 'TRADER_RESPONDED' || dispute.status === 'UNDER_REVIEW') return 'low';
  return 'medium';
}

function buildDisputeOutcome(dispute) {
  switch (dispute?.status) {
    case 'RESOLVED_FOR_USER':
      return 'Refund user';
    case 'RESOLVED_FOR_TRADER':
      return 'Release to trader';
    case 'DISMISSED':
      return 'Dismissed';
    case 'CLOSED':
      return dispute?.closure_reason || 'Closed';
    default:
      return null;
  }
}

function parseAdminNotes(adminNotes, dispute) {
  if (!adminNotes || !adminNotes.trim()) return [];

  return adminNotes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^\[(.+?)\]\s*(.*)$/);
      const tag = match?.[1] || 'NOTE';
      const text = match?.[2] || line;
      const author = tag === 'ESCALATED' ? 'Admin escalation' : 'Admin';
      return {
        type: tag.toLowerCase(),
        text,
        author,
        created_at: dispute.updated_at || dispute.created_at,
      };
    });
}

function buildDisputeTimeline(dispute) {
  if (!dispute) return [];

  const events = [];

  if (dispute.created_at) {
    events.push({
      timestamp: dispute.created_at,
      message: 'Dispute opened by user',
    });
  }

  if (dispute.trader_response_at) {
    events.push({
      timestamp: dispute.trader_response_at,
      message: 'Trader submitted a response and payment proof',
    });
  }

  if (dispute.escalated_at) {
    events.push({
      timestamp: dispute.escalated_at,
      message: dispute.escalation_reason
        ? `Admin escalated dispute: ${dispute.escalation_reason}`
        : 'Admin escalated dispute for review',
    });
  }

  if (dispute.resolved_at) {
    events.push({
      timestamp: dispute.resolved_at,
      message: dispute.resolution_reason
        ? `Dispute resolved: ${dispute.resolution_reason}`
        : `Dispute resolved as ${dispute.status}`,
    });
  }

  if (dispute.status === 'DISMISSED' && dispute.updated_at) {
    events.push({
      timestamp: dispute.updated_at,
      message: dispute.closure_reason
        ? `Dispute dismissed: ${dispute.closure_reason}`
        : 'Dispute dismissed by admin',
    });
  }

  if (dispute.status === 'CLOSED' && dispute.updated_at) {
    events.push({
      timestamp: dispute.updated_at,
      message: dispute.closure_reason
        ? `Dispute closed: ${dispute.closure_reason}`
        : 'Dispute closed',
    });
  }

  return events
    .filter((event) => event.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function withDisputePresentationFields(dispute) {
  if (!dispute) return dispute;

  const notes = parseAdminNotes(dispute.admin_notes, dispute);
  return {
    ...dispute,
    traderName: dispute.trader_name,
    userPhone: dispute.user_phone,
    transactionState: dispute.transaction_state,
    fiatAmount: dispute.fiat_amount,
    fiatCurrency: dispute.fiat_currency,
    usdcAmount: dispute.usdc_amount,
    traderResponse: dispute.trader_response,
    respondedAt: dispute.trader_response_at,
    resolutionNote: dispute.resolution_reason || dispute.closure_reason,
    priority: computeDisputePriority(dispute),
    outcome: buildDisputeOutcome(dispute),
    notes,
    timeline: buildDisputeTimeline(dispute),
  };
}

/**
 * Get dispute by ID
 */
async function getDisputeById(disputeId) {
  const result = await db.query(
    `SELECT d.*, t.name as trader_name, u.phone_hash as user_phone,
            tx.state as transaction_state, tx.usdc_amount, tx.fiat_amount, tx.fiat_currency, tx.network
     FROM disputes d
     LEFT JOIN traders t ON t.id = d.trader_id
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN transactions tx ON tx.id = d.transaction_id
     WHERE d.id = $1`,
    [disputeId]
  );
  return withDisputePresentationFields(result.rows[0]);
}

/**
 * List disputes with filtering
 */
async function listDisputes(filters = {}) {
  const { status, traderId, userId, limit = 50, offset = 0 } = filters;

  let query = `
    SELECT d.*, t.name as trader_name, tr.fiat_amount, tr.fiat_currency,
           tr.state as transaction_state, tr.usdc_amount, tr.network
    FROM disputes d
    LEFT JOIN traders t ON t.id = d.trader_id
    LEFT JOIN transactions tr ON tr.id = d.transaction_id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (status) {
    query += ` AND d.status = $${paramCount++}`;
    params.push(status);
  }
  if (traderId) {
    query += ` AND d.trader_id = $${paramCount++}`;
    params.push(traderId);
  }
  if (userId) {
    query += ` AND d.user_id = $${paramCount++}`;
    params.push(userId);
  }

  query += ` ORDER BY d.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
  params.push(limit, offset);

  const result = await db.query(query, params);
  return result.rows.map(withDisputePresentationFields);
}

export default {
  createDispute,
  traderRespond,
  adminAction,
  getDisputeById,
  listDisputes,
  VALID_TRANSITIONS,
};
