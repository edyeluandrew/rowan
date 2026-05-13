import db from '../db/index.js';
import logger from '../utils/logger.js';
import websocket from './websocket.js';

/**
 * TransactionStateMachine — centralizes ALL state transitions.
 *
 * Every state change in the system MUST go through this module to ensure:
 *   1. Valid transition (enforced by VALID_TRANSITIONS map)
 *   2. Timestamp recording for each state
 *   3. Audit trail via console log (Phase 2: write to audit_log table)
 *   4. Optimistic locking via state guard in WHERE clause
 *
 * States:
 *   QUOTE_REQUESTED → QUOTE_CONFIRMED → ESCROW_LOCKED → TRADER_MATCHED
 *   → FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING → COMPLETE
 *   Any → FAILED → REFUNDED
 *   FIAT_PAYOUT_SUBMITTED → DISPUTE_OPENED (user didn't receive payment)
 *   USER_CONFIRMATION_PENDING → RELEASE_BLOCKED (trustline issue)
 */

const VALID_TRANSITIONS = {
  QUOTE_REQUESTED:  ['QUOTE_CONFIRMED', 'FAILED'],
  QUOTE_CONFIRMED:  ['ESCROW_LOCKED', 'FAILED'],
  ESCROW_LOCKED:    ['TRADER_MATCHED', 'FAILED', 'REFUNDED'],
  // CRITICAL FIX: Removed backward transition to ESCROW_LOCKED
  // Traders are assigned/reassigned WITHOUT changing state
  // This prevents transaction regression (TRADER_MATCHED → ESCROW_LOCKED → TRADER_MATCHED)
  TRADER_MATCHED:   ['FIAT_PAYOUT_SUBMITTED', 'FAILED', 'REFUNDED'],
  FIAT_PAYOUT_SUBMITTED: ['USER_CONFIRMATION_PENDING', 'DISPUTE_OPENED', 'FAILED', 'REFUNDED'],
  USER_CONFIRMATION_PENDING: ['COMPLETE', 'RELEASE_BLOCKED', 'FAILED', 'REFUNDED'],
  RELEASE_BLOCKED:  ['COMPLETE', 'FAILED', 'REFUNDED'],
  DISPUTE_OPENED:   ['DISPUTE_REFUND_PENDING', 'DISPUTE_RELEASE_PENDING', 'FAILED', 'REFUNDED'], // admin resolves disputes
  DISPUTE_REFUND_PENDING: ['REFUNDED'],  // float released, XLM refunded to user
  DISPUTE_RELEASE_PENDING: ['COMPLETE'],  // float finalized, USDC released to trader
  FAILED:           ['REFUNDED'],
  COMPLETE:         [], // terminal
  REFUNDED:         [], // terminal
};

// Map state → timestamp column
const STATE_TIMESTAMPS = {
  QUOTE_CONFIRMED:  'quote_confirmed_at',
  ESCROW_LOCKED:    'escrow_locked_at',
  TRADER_MATCHED:   'trader_matched_at',
  FIAT_PAYOUT_SUBMITTED: 'fiat_payout_submitted_at',
  USER_CONFIRMATION_PENDING: 'user_confirmation_pending_at',
  DISPUTE_REFUND_PENDING: 'dispute_resolved_at',
  DISPUTE_RELEASE_PENDING: 'dispute_resolved_at',
  COMPLETE:         'completed_at',
  FAILED:           'failed_at',
  REFUNDED:         'refunded_at',
};

/**
 * Transition a transaction to a new state.
 *
 * @param {string} transactionId - UUID
 * @param {string} fromState     - expected current state (optimistic lock)
 * @param {string} toState       - target state
 * @param {object} [extra={}]    - additional columns to SET (e.g., { trader_id, stellar_release_tx })
 * @returns {object|null}        - updated transaction row, or null if guard failed
 */
async function transition(transactionId, fromState, toState, extra = {}) {
  // Capture call stack for debugging
  const stack = new Error().stack.split('\n').slice(1, 6).map(s => s.trim()).join(' | ');
  logger.debug(`[StateMachine:transition] CALLED: ${transactionId} ${fromState}→${toState}. Caller: ${stack}`);

  // 1. Validate the transition
  const allowed = VALID_TRANSITIONS[fromState];
  if (!allowed || !allowed.includes(toState)) {
    throw new Error(`Invalid state transition: ${fromState} → ${toState} for tx ${transactionId}`);
  }

  // 2. Build the dynamic SET clause
  const sets = ['state = $1'];
  const params = [toState];
  let idx = 2;

  // Auto-set the timestamp for this state
  const tsCol = STATE_TIMESTAMPS[toState];
  if (tsCol) {
    sets.push(`${tsCol} = NOW()`);
  }

  // Apply any extra columns
  for (const [col, val] of Object.entries(extra)) {
    sets.push(`${col} = $${idx}`);
    params.push(val);
    idx++;
  }

  // WHERE guard: transaction must be in fromState
  params.push(transactionId);
  params.push(fromState);

  const query = `
    UPDATE transactions
    SET ${sets.join(', ')}
    WHERE id = $${idx} AND state = $${idx + 1}
    RETURNING *
  `;

  const result = await db.query(query, params);
  const row = result.rows[0];

  if (!row) {
    logger.warn(`[StateMachine] GUARD_FAILED: tx ${transactionId} not in ${fromState} (may be in different state). Cannot transition to ${toState}`);
    return null;
  }

  logger.warn(`[StateMachine:SUCCESS] tx ${transactionId}: ${fromState} → ${toState} | extra: ${JSON.stringify(extra)}`);

  // Broadcast transaction update to all admins for real-time dashboard
  try {
    websocket.broadcast('admin', 'transaction_state_changed', {
      id: row.id,
      state: row.state,
      trader_id: row.trader_id,
      user_id: row.user_id,
      usdc_amount: row.usdc_amount,
      fiat_amount: row.fiat_amount,
      fiat_currency: row.fiat_currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ...extra,
    });
  } catch (err) {
    logger.error(`[StateMachine] Failed to broadcast transaction update: ${err.message}`);
  }

  return row;
}

/**
 * Check if a transition is valid without executing it.
 */
function isValidTransition(fromState, toState) {
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

/**
 * Handle dispute-related transaction state updates.
 * Disputes can change transaction state based on resolution.
 *
 * @param {string} transactionId - transaction in dispute
 * @param {string} action - 'DISPUTE_OPENED', 'DISPUTE_WON_USER', 'DISPUTE_WON_TRADER'
 * @param {object} extra - additional data
 */
async function transitionForDispute(transactionId, action, extra = {}) {
  let targetState = null;

  // Determine target state based on dispute action
  switch (action) {
    case 'DISPUTE_OPENED':
      // Hold transaction state (don't change it, just record dispute_id)
      logger.info(`[StateMachine] Dispute opened for tx ${transactionId}, holding state`);
      await db.query(
        `UPDATE transactions 
         SET dispute_id = $1, dispute_started_at = NOW(), updated_at = NOW() 
         WHERE id = $2`,
        [extra.dispute_id, transactionId]
      );
      return;

    case 'DISPUTE_WON_USER':
      // User won dispute - transition to refund pending state
      targetState = 'DISPUTE_REFUND_PENDING';
      break;

    case 'DISPUTE_WON_TRADER':
      // Trader won dispute - transition to release pending state
      targetState = 'DISPUTE_RELEASE_PENDING';
      break;

    default:
      throw new Error(`Unknown dispute action: ${action}`);
  }

  if (targetState) {
    logger.info(`[StateMachine] Dispute resolution: tx ${transactionId} → ${targetState}`);
    
    // Transition from DISPUTE_OPENED to target state
    const result = await transition(transactionId, 'DISPUTE_OPENED', targetState, extra);
    if (!result) {
      throw new Error(`Failed to transition tx ${transactionId} to ${targetState}: not in DISPUTE_OPENED state`);
    }
    return result;
  }
}

/**
 * Helper to check if a state is terminal (no further transitions possible).
 */
function isTerminal(state) {
  return VALID_TRANSITIONS[state]?.length === 0 || !VALID_TRANSITIONS[state];
}

export default {
  transition,
  isValidTransition,
  transitionForDispute,
  isTerminal,
  VALID_TRANSITIONS,
  STATE_TIMESTAMPS,
};
