import db from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * FraudMonitor — L2 internal module.
 * Enforces per-user daily limits and per-transaction caps (scaling with KYC level),
 * flags admin alerts for suspicious patterns, and triggers auto-refunds.
 */

// KYC-tiered limits (in UGX equivalent)
const KYC_LIMITS = {
  NONE:     { perTx: 200000,   daily: 500000   },  // ~$53 / ~$133
  BASIC:    { perTx: 1000000,  daily: 3000000  },  // ~$267 / ~$800
  VERIFIED: { perTx: 5000000,  daily: 15000000 },  // ~$1,333 / ~$4,000
};

/**
 * Check if a user's requested cash-out violates any fraud rules.
 * Returns { allowed: boolean, reason?: string }
 */
async function checkTransaction(userId, fiatAmount, fiatCurrency) {
  const userResult = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
  const user = userResult.rows[0];
  if (!user) return { allowed: false, reason: 'User not found' };
  if (!user.is_active) return { allowed: false, reason: 'Account disabled' };

  const limits = KYC_LIMITS[user.kyc_level] || KYC_LIMITS.NONE;
  const amount = parseFloat(fiatAmount);

  // 1. Per-transaction cap
  if (amount > limits.perTx) {
    await logAlert(userId, 'PER_TX_LIMIT', `Attempted ${amount} ${fiatCurrency}, limit is ${limits.perTx}`);
    return { allowed: false, reason: `Exceeds per-transaction limit of ${limits.perTx} ${fiatCurrency} for KYC level ${user.kyc_level}` };
  }

  // 2. Daily limit — sum fiat moved today
  const dailyResult = await db.query(
    `SELECT COALESCE(SUM(fiat_amount), 0) as daily_total
     FROM transactions
     WHERE user_id = $1
       AND state NOT IN ('FAILED', 'REFUNDED')
       AND created_at >= CURRENT_DATE`,
    [userId]
  );
  const dailyTotal = parseFloat(dailyResult.rows[0].daily_total);
  if (dailyTotal + amount > limits.daily) {
    await logAlert(userId, 'DAILY_LIMIT', `Daily total would be ${dailyTotal + amount}, limit is ${limits.daily}`);
    return { allowed: false, reason: `Exceeds daily limit of ${limits.daily} ${fiatCurrency} (used today: ${dailyTotal})` };
  }

  // 3. Concurrent quote check — flag users requesting multiple simultaneous quotes
  const concurrentResult = await db.query(
    `SELECT COUNT(*) as open_quotes
     FROM quotes
     WHERE user_id = $1 AND is_used = FALSE AND expires_at > NOW()`,
    [userId]
  );
  const openQuotes = parseInt(concurrentResult.rows[0].open_quotes);
  if (openQuotes >= 3) {
    await logAlert(userId, 'CONCURRENT_QUOTES', `User has ${openQuotes} open quotes simultaneously`);
    return { allowed: false, reason: 'Too many open quotes. Please wait for existing quotes to expire.' };
  }

  // 4. Flag unusually large transactions (above 80% of limit)
  if (amount > limits.perTx * 0.8) {
    await logAlert(userId, 'LARGE_TX', `Transaction of ${amount} ${fiatCurrency} is above 80% of per-tx limit`);
    // Allow but flag — admin can review
  }

  return { allowed: true };
}

/**
 * Check if a trader has repeated failed confirmations — potential fraud signal.
 */
async function checkTraderHealth(traderId) {
  // Failed confirmations in last 24 hours
  const failedResult = await db.query(
    `SELECT COUNT(*) as failed_count
     FROM transactions
     WHERE trader_id = $1
       AND state = 'FAILED'
       AND failed_at >= NOW() - INTERVAL '24 hours'`,
    [traderId]
  );
  const failedCount = parseInt(failedResult.rows[0].failed_count);

  if (failedCount >= 5) {
    await logAlert(null, 'TRADER_REPEATED_FAILURES', `Trader ${traderId} has ${failedCount} failures in 24h`, traderId);
    // ── P2 FIX: Use status enum instead of is_active boolean ──
    await db.query(
      `UPDATE traders SET status = 'PAUSED', is_active = FALSE WHERE id = $1`,
      [traderId]
    );
    return { healthy: false, reason: 'Auto-paused due to repeated failures' };
  }

  // Open disputes
  const disputeResult = await db.query(
    `SELECT COUNT(*) as dispute_count
     FROM disputes
     WHERE trader_id = $1 AND status IN ('OPEN', 'RESOLVED_FOR_USER')`,
    [traderId]
  );
  if (parseInt(disputeResult.rows[0].dispute_count) >= 3) {
    // ── P2 FIX: Use status enum instead of is_suspended boolean ──
    await db.query(
      `UPDATE traders SET status = 'SUSPENDED', is_suspended = TRUE WHERE id = $1`,
      [traderId]
    );
    return { healthy: false, reason: 'Auto-suspended: 3+ disputes' };
  }

  return { healthy: true };
}

/**
 * Log a fraud alert for admin review.
 * [L-4 FIX] Persists to fraud_alerts table for admin dashboard visibility.
 */
async function logAlert(userId, alertType, details, traderId = null) {
  // Derive severity from alert type
  const severityMap = {
    PER_TX_LIMIT: 'HIGH',
    DAILY_LIMIT: 'HIGH',
    CONCURRENT_QUOTES: 'MEDIUM',
    LARGE_TX: 'LOW',
    TRADER_REPEATED_FAILURES: 'HIGH',
  };
  const severity = severityMap[alertType] || 'MEDIUM';

  logger.warn(`[FraudMonitor] ALERT — type: ${alertType}, severity: ${severity}, user: ${userId || 'N/A'}, details: ${details}`);

  try {
    await db.query(
      `INSERT INTO fraud_alerts (user_id, trader_id, alert_type, details, severity)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId || null, traderId, alertType, details, severity]
    );
  } catch (err) {
    logger.error('[FraudMonitor] Failed to persist alert:', err.message);
  }
}

export default {
  checkTransaction,
  checkTraderHealth,
  logAlert,
  KYC_LIMITS,
};
