import { server as horizon } from '../config/stellar.js';
import config from '../config/index.js';
import redis from '../db/redis.js';
import escrowController from '../services/escrowController.js';
import logger from '../utils/logger.js';

const CURSOR_KEY = 'horizon:escrow:cursor';

let closeStream = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let lastPaymentAt = Date.now();

// Max interval (ms) without any stream event before forcing reconnect
const HEARTBEAT_INTERVAL_MS = 600_000; // 10 minutes (was 2 minutes)

/**
 * Start watching the escrow account for incoming payments via Horizon event streaming.
 * This is the trigger that fires the entire post-deposit pipeline:
 *   deposit verified → XLM→USDC swap → trader matching → payout
 */
async function startWatcher() {
  const escrowAddress = config.stellar.escrowPublicKey;
  if (!escrowAddress) {
    logger.error('[Horizon] No escrow public key configured — watcher NOT started');
    return;
  }

  logger.info(`[Horizon] Starting payment watcher for escrow: ${escrowAddress}`);

  // ── C8 FIX: Resume from persisted cursor on restart ──
  let cursor = 'now';
  try {
    const savedCursor = await redis.get(CURSOR_KEY);
    if (savedCursor) {
      cursor = savedCursor;
      logger.info(`[Horizon] Resuming from persisted cursor: ${cursor}`);
    } else {
      // First boot: get latest cursor from Horizon
      const txs = await horizon
        .transactions()
        .forAccount(escrowAddress)
        .order('desc')
        .limit(1)
        .call();

      if (txs.records.length > 0) {
        cursor = txs.records[0].paging_token;
      }
    }
  } catch (err) {
    // Account might not exist on testnet yet — that's fine, start from 'now'
    logger.warn('[Horizon] Could not fetch latest cursor, starting from "now":', err.message);
  }

  // Stream payments to escrow address
  closeStream = horizon
    .payments()
    .forAccount(escrowAddress)
    .cursor(cursor)
    .stream({
      onmessage: (payment) => {
        lastPaymentAt = Date.now();
        logger.info(`[Horizon] ⭐ Payment event: ${payment.from} → ${payment.to} (${payment.amount} XLM)`);
        handlePayment(payment);
      },
      onerror: (err) => {
        logger.error('[Horizon] Stream error:', err?.message || err);
        // [AUDIT FIX] Explicit reconnection with backoff
        scheduleReconnect();
      },
    });

  // [AUDIT FIX] Heartbeat watchdog — reconnect if stream goes silent
  startHeartbeat();

  logger.info('[Horizon] Payment stream active');
}

/**
 * Schedule a stream reconnection with a delay.
 */
function scheduleReconnect() {
  if (reconnectTimer) return; // already scheduled
  const delay = 5000 + Math.random() * 5000; // 5-10s jitter
  logger.info(`[Horizon] Scheduling reconnect in ${Math.round(delay)}ms`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      stopWatcher();
      await startWatcher();
    } catch (err) {
      logger.error('[Horizon] Reconnect failed:', err.message);
      scheduleReconnect(); // retry
    }
  }, delay);
}

/**
 * Heartbeat watchdog — if no events received for HEARTBEAT_INTERVAL_MS, reconnect.
 */
function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (Date.now() - lastPaymentAt > HEARTBEAT_INTERVAL_MS && closeStream) {
      logger.warn('[Horizon] No events in 10 minutes — forcing reconnect');
      scheduleReconnect();
    }
  }, HEARTBEAT_INTERVAL_MS / 2);
}

/**
 * Handle an individual payment event from Horizon.
 */
async function handlePayment(payment) {
  try {
    // Only process incoming payments (not outgoing swaps/releases)
    if (payment.to !== config.stellar.escrowPublicKey) return;
    if (payment.from === config.stellar.escrowPublicKey) return; // self-swap

    // Only process native XLM payments (not USDC receipts)
    if (payment.asset_type !== 'native') return;

    logger.info(`[Horizon] ✅ Processing XLM payment: ${payment.from} → ${payment.to} (${payment.amount} XLM)`);

    // Fetch the parent transaction to get the memo
    const tx = await payment.transaction();
    const memo = tx.memo || '';

    logger.info(`[Horizon] 📋 Transaction memo: "${memo}"`);

    if (!memo.startsWith('ROWAN-qt_')) {
      logger.warn(`[Horizon] ⚠️  Payment without Rowan memo — ignoring (memo: "${memo}")`);
      return;
    }

    logger.info(`[Horizon] 🎯 Valid Rowan payment detected! Creating transaction record...`);

    await escrowController.handleDeposit({
      memo,
      amount: payment.amount,
      sourceAccount: payment.from,
      txHash: tx.hash,
    });

    logger.info(`[Horizon] ✨ Transaction record created successfully for memo: ${memo}`);

    // ── C8 FIX: Persist cursor after successful processing ──
    if (payment.paging_token) {
      await redis.set(CURSOR_KEY, payment.paging_token);
    }
  } catch (err) {
    logger.error('[Horizon] ❌ Error processing payment:', err.message);
    if (err.response?.data) logger.error('[Horizon] Response:', err.response.data);
  }
}

/**
 * Stop the Horizon stream (for graceful shutdown).
 */
function stopWatcher() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (closeStream) {
    closeStream();
    closeStream = null;
    logger.info('[Horizon] Payment stream stopped');
  }
}

/**
 * Get watcher status for health checks.
 */
function getStatus() {
  return closeStream ? 'connected' : 'disconnected';
}

export default { startWatcher, stopWatcher, getStatus };