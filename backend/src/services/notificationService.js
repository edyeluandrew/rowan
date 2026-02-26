import websocket from './websocket.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

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
 * [L-2 FIX] Send SMS fallback for critical events.
 * Checks if the user has a connected WebSocket — if not, falls back to SMS.
 */
async function smsFallback(userId, message) {
  if (!config.enableSmsFallback) return;
  try {
    // Check if user has an active WebSocket connection
    const userRoom = websocket.getIo()?.sockets?.adapter?.rooms?.get(`user:${userId}`);
    if (userRoom && userRoom.size > 0) return; // User is online, no SMS needed

    // Look up user's phone number (stored as hash — we need the actual number from a secure vault)
    // For MVP, we skip SMS if we can't resolve the phone. Phase 2 will add phone vault.
    logger.info(`[Notify] SMS fallback would be sent to user ${userId}: ${message}`);
  } catch (err) {
    logger.warn(`[Notify] SMS fallback failed for user ${userId}:`, err.message);
  }
}

/**
 * Notify a wallet user of a transaction status change.
 */
function notifyUser(userId, event, data) {
  // WebSocket push (primary channel)
  websocket.emitToUser(userId, 'tx_update', {
    ...data,
    timestamp: new Date().toISOString(),
  });

  logger.info(`[Notify] User ${userId} — ${event}: ${data.message || data.state}`);

  // [L-2 FIX] SMS fallback for critical events
  if (['COMPLETE', 'REFUNDED', 'FAILED'].includes(data.state)) {
    smsFallback(userId, data.message || `Transaction ${data.state}`).catch(() => {});
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
 */
function notifyTransactionComplete(userId, traderId, transaction) {
  notifyUser(userId, 'tx_complete', {
    transactionId: transaction.id,
    state: 'COMPLETE',
    fiatAmount: transaction.fiat_amount,
    fiatCurrency: transaction.fiat_currency,
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
 */
function notifyRefund(userId, transaction, reason) {
  notifyUser(userId, 'tx_refund', {
    transactionId: transaction.id,
    state: 'REFUNDED',
    xlmAmount: transaction.xlm_amount,
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
};
