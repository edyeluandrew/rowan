/**
 * AdminRealTimeService — Centralized real-time update broadcasting for admin panel
 * All admin features (traders, disputes, escrow, analytics, rates, system health) broadcast here
 */

import notificationService from './notificationService.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Broadcast updated overview stats to all admins
 */
async function broadcastOverviewUpdate() {
  try {
    const txToday = await db.query(`
      SELECT
        COUNT(*) as transactions_today,
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as completed_today,
        COUNT(*) FILTER (WHERE state = 'FAILED') as failed_today,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'COMPLETE'), 0) as volume_today
      FROM transactions
      WHERE created_at >= CURRENT_DATE
    `);

    const tradersResult = await db.query(`SELECT COUNT(*) as active_traders FROM traders WHERE status = 'ACTIVE'`);
    const disputesResult = await db.query(`SELECT COUNT(*) as open_disputes FROM disputes WHERE status = 'OPEN'`);
    const revResult = await db.query(`
      SELECT COALESCE(SUM(q.platform_fee), 0) as revenue_today
      FROM transactions t
      JOIN quotes q ON q.id = t.quote_id
      WHERE t.state = 'COMPLETE' AND t.completed_at >= CURRENT_DATE
    `);

    const escrowResult = await db.query(`
      SELECT COALESCE(SUM(usdc_amount), 0) as escrow_locked
      FROM transactions
      WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')
    `);

    const txRow = txToday.rows[0];
    const total = parseInt(txRow.transactions_today) || 0;
    const completed = parseInt(txRow.completed_today) || 0;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : null;

    const stats = {
      transactions_today: parseInt(txRow.transactions_today),
      active_traders: parseInt(tradersResult.rows[0].active_traders),
      open_disputes: parseInt(disputesResult.rows[0].open_disputes),
      revenue_today: parseFloat(revResult.rows[0].revenue_today),
      volume_today: parseFloat(txRow.volume_today),
      failed_today: parseInt(txRow.failed_today),
      success_rate: successRate,
      escrow_locked: parseFloat(escrowResult.rows[0].escrow_locked),
    };

    notificationService.notifyAdminStatsUpdate(stats, 'stats_update');
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast overview update:', err.message);
  }
}

/**
 * Broadcast metrics update to all admins
 */
async function broadcastMetricsUpdate() {
  try {
    const todayResult = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE state = 'COMPLETE') as completed_today,
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

    const metrics = {
      revenue_today: parseFloat(revenueResult.rows[0].revenue_today),
      volume_today: parseFloat(todayResult.rows[0].usdc_volume_today),
      transactions_today: parseInt(todayResult.rows[0].completed_today),
    };

    notificationService.notifyAdminAnalyticsUpdate(metrics, 'analytics_update');
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast metrics update:', err.message);
  }
}

/**
 * Broadcast escrow status to all admins
 */
async function broadcastEscrowUpdate() {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'ESCROW_LOCKED'), 0) as total_locked,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'TRADER_MATCHED'), 0) as awaiting_release,
        COALESCE(SUM(usdc_amount) FILTER (WHERE state = 'FIAT_SENT'), 0) as pending_confirmation,
        COUNT(*) FILTER (WHERE state IN ('ESCROW_LOCKED', 'TRADER_MATCHED', 'FIAT_SENT')) as active_transactions
      FROM transactions
    `);

    const escrow = {
      total_locked: parseFloat(result.rows[0].total_locked),
      awaiting_release: parseFloat(result.rows[0].awaiting_release),
      pending_confirmation: parseFloat(result.rows[0].pending_confirmation),
      active_transactions: parseInt(result.rows[0].active_transactions),
      health_status: parseFloat(result.rows[0].total_locked) > 50000 ? 'warning' : 'healthy',
    };

    notificationService.notifyAdminEscrowUpdate(escrow, 'escrow_update');
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast escrow update:', err.message);
  }
}

/**
 * Broadcast trader list update to all admins
 * Called when a trader is created, updated, or verified
 */
async function broadcastTraderListUpdate() {
  try {
    const result = await db.query(`
      SELECT id, name, email, status, verification_status, trust_score, is_suspended, created_at, updated_at
      FROM traders
      ORDER BY created_at DESC
      LIMIT 50
    `);

    result.rows.forEach((trader) => {
      notificationService.notifyAdminTraderUpdate(trader, 'trader_update');
    });
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast trader list update:', err.message);
  }
}

/**
 * Broadcast dispute list update to all admins
 * Called when a dispute is created or updated
 */
async function broadcastDisputeListUpdate() {
  try {
    const result = await db.query(`
      SELECT id, transaction_id, user_id, trader_id, reason, status, created_at, updated_at
      FROM disputes
      WHERE status = 'OPEN'
      ORDER BY created_at DESC
      LIMIT 50
    `);

    result.rows.forEach((dispute) => {
      notificationService.notifyAdminDisputeUpdate(dispute, 'dispute_update');
    });
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast dispute list update:', err.message);
  }
}

/**
 * Broadcast system health update to all admins
 */
async function broadcastSystemHealthUpdate(health) {
  try {
    notificationService.notifyAdminSystemHealth(health, 'system_health_update');
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast system health update:', err.message);
  }
}

/**
 * Broadcast rates update to all admins
 */
async function broadcastRatesUpdate(rates) {
  try {
    notificationService.notifyAdminRatesUpdate(rates, 'rates_update');
  } catch (err) {
    logger.error('[RealTime] Failed to broadcast rates update:', err.message);
  }
}

export default {
  broadcastOverviewUpdate,
  broadcastMetricsUpdate,
  broadcastEscrowUpdate,
  broadcastTraderListUpdate,
  broadcastDisputeListUpdate,
  broadcastSystemHealthUpdate,
  broadcastRatesUpdate,
};
