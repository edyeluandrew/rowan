import websocket from './websocket.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import redis from '../db/redis.js';

/**
 * NotificationService — L2 internal module.
 * Handles all outbound notifications:
 *   - In-app push via WebSocket (primary)
 *   - SMS fallback for critical events (if ENABLE_SMS_FALLBACK=true)
 *   - Email (Phase 3)
 */

// Lazy-load OTP service (has sendSms) to avoid circular deps
let otpServiceModule = null;
async function getOtpService() {
  if (!otpServiceModule) {
    otpServiceModule = (await import('./otpService.js')).default;
  }
  return otpServiceModule;
}

/**
 * [L-2 FIX] Send SMS fallback for critical events via Africa's Talking.
 * Checks if the user has a connected WebSocket — if not, falls back to SMS.
 *
 * Phone numbers are looked up from Redis cache (populated during transaction creation).
 * If not available in cache, SMS is skipped with a warning (Phase 2: add secure vault).
 *
 * @param {string} userId - user ID
 * @param {string} message - SMS message body
 * @param {string|null} phoneNumber - optional E.164 phone number (if not provided, will look up from cache)
 * @returns {Promise<void>}
 */
async function smsFallback(userId, message, phoneNumber = null) {
  if (!config.enableSmsFallback) return;
  try {
    // Check if user has an active WebSocket connection
    const userRoom = websocket.getIo()?.sockets?.adapter?.rooms?.get(`user:${userId}`);
    if (userRoom && userRoom.size > 0) return; // User is online, no SMS needed

    // Try to get phone number if not provided
    let phone = phoneNumber;
    if (!phone) {
      try {
        // Look for cached phone number (stored during transaction creation)
        const cached = await redis.get(`user:phone:${userId}`);
        if (cached) {
          phone = cached;
          logger.debug(`[Notify] Retrieved cached phone for user ${userId}`);
        }
      } catch (err) {
        logger.warn(`[Notify] Failed to retrieve cached phone for user ${userId}:`, err.message);
      }
    }

    if (!phone) {
      logger.warn(`[Notify] SMS skipped for user ${userId} — no phone number available. Will be available in Phase 2 with secure vault.`);
      return;
    }

    // Send SMS via Africa's Talking
    const otpService = await getOtpService();
    const result = await otpService.sendSms(phone, message);
    if (result.sent) {
      logger.info(`[Notify] SMS sent to user ${userId} (msgId: ${result.messageId})`);
    } else {
      logger.error(`[Notify] SMS delivery failed for user ${userId}: ${result.error}`);
    }
  } catch (err) {
    logger.warn(`[Notify] SMS fallback failed for user ${userId}:`, err.message);
  }
}

/**
 * Cache a user's phone number in Redis for SMS fallback.
 * Called during transaction creation to store the phone for later use.
 *
 * @param {string} userId - user ID
 * @param {string} phoneNumber - phone number in E.164 format (+256701234567)
 * @param {number} ttlSeconds - TTL in seconds (default: 7 days for transaction lifetime)
 */
async function cacheUserPhoneNumber(userId, phoneNumber, ttlSeconds = 604800) {
  try {
    const key = `user:phone:${userId}`;
    await redis.set(key, phoneNumber, 'EX', ttlSeconds);
    logger.debug(`[Notify] Cached phone number for user ${userId}`);
  } catch (err) {
    logger.error(`[Notify] Failed to cache phone number for user ${userId}:`, err.message);
  }
}

/**
 * Retrieve a user's cached phone number from Redis.
 *
 * @param {string} userId - user ID
 * @returns {Promise<string|null>} phone number or null if not found
 */
async function getCachedPhoneNumber(userId) {
  try {
    return await redis.get(`user:phone:${userId}`);
  } catch (err) {
    logger.error(`[Notify] Failed to retrieve cached phone for user ${userId}:`, err.message);
    return null;
  }
}

/**
 * Notify a wallet user of a transaction status change.
 * Supports SMS fallback for offline users on transaction completion/refund.
 *
 * @param {string} userId - user ID
 * @param {string} event - event type
 * @param {object} data - notification data (includes state, message, and optional phoneNumber)
 */
async function notifyUser(userId, event, data) {
  // WebSocket push (primary channel)
  websocket.emitToUser(userId, 'tx_update', {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info(`[Notify] User ${userId} — ${event}: ${data.message || data.state}`);

  // [L-2 FIX] SMS fallback for critical events (COMPLETE, REFUNDED, FAILED)
  if (['COMPLETE', 'REFUNDED', 'FAILED'].includes(data.state)) {
    // Pass phone number if provided in data, or let smsFallback look it up from cache
    const phoneNumber = data.phoneNumber || null;
    try {
      await smsFallback(userId, data.message || `Transaction ${data.state}`, phoneNumber);
    } catch (err) {
      logger.error(`[Notify] SMS fallback error for user ${userId}:`, err.message);
    }
  }
}

/**
 * Notify a trader of a new incoming request.
 */
function notifyTraderNewRequest(traderId, requestData) {
  websocket.emitToTrader(traderId, 'new_request', {
    ...requestData,
    timestamp: new Date().toISOString(),
  });

  logger.info(`[Notify] Trader ${traderId} — new request: ${requestData.transactionId}`);
}

/**
 * Notify a trader of a request update (expired, re-assigned, etc.).
 */
function notifyTraderUpdate(traderId, event, data) {
  websocket.emitToTrader(traderId, event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send transaction completion notifications to both parties.
 * Passes phone number to SMS fallback if available.
 */
async function notifyTransactionComplete(userId, traderId, transaction, phoneNumber = null) {
  await notifyUser(userId, 'tx_complete', {
    transactionId: transaction.id,
    state: 'COMPLETE',
    fiatAmount: transaction.fiat_amount,
    fiatCurrency: transaction.fiat_currency,
    phoneNumber, // Include phone for SMS fallback
    message: `Cash-out complete! ${transaction.fiat_amount} ${transaction.fiat_currency} sent to your mobile money.`,
  });

  notifyTraderUpdate(traderId, 'tx_complete', {
    transactionId: transaction.id,
    usdcAmount: transaction.usdc_amount,
    message: `USDC released to your wallet.`,
  });
}

/**
 * Send refund notification to user.
 * Passes phone number to SMS fallback if available.
 */
async function notifyRefund(userId, transaction, reason, phoneNumber = null) {
  await notifyUser(userId, 'tx_refund', {
    transactionId: transaction.id,
    state: 'REFUNDED',
    xlmAmount: transaction.xlm_amount,
    phoneNumber, // Include phone for SMS fallback
    message: `Your ${transaction.xlm_amount} XLM has been refunded. Reason: ${reason}`,
  });
}

/**
 * Notify admin(s) of a new trader verification submission.
 */
function notifyAdminNewSubmission(traderId, traderName) {
  // Broadcast to all admin sockets
  websocket.broadcast('admin', 'trader_submission', {
    traderId,
    traderName,
    message: `New trader submission from ${traderName} — pending review.`,
    timestamp: new Date().toISOString(),
  });
  logger.info(`[Notify] Admin — new trader submission: ${traderName} (${traderId})`);
}

/**
 * Notify trader of verification result.
 */
function notifyTraderVerificationResult(traderId, status, message) {
  websocket.emitToTrader(traderId, 'verification_update', {
    status,
    message,
    timestamp: new Date().toISOString(),
  });
  logger.info(`[Notify] Trader ${traderId} — verification ${status}`);
}

/**
 * Phase 2: Send SMS via aggregator API.
 * Placeholder for Flutterwave / Africa's Talking integration.
 */
// async function sendSms(userId, message) {
//   const user = await db.query('SELECT phone_hash FROM users WHERE id = $1', [userId]);
//   // Would need to decrypt/lookup actual phone number from a secure vault
//   // await africasTalking.sms.send({ to: phone, message });
// }

export default {
  notifyUser,
  notifyTraderNewRequest,
  notifyTraderUpdate,
  notifyTransactionComplete,
  notifyRefund,
  notifyAdminNewSubmission,
  notifyTraderVerificationResult,
  cacheUserPhoneNumber,
  getCachedPhoneNumber,
};
