import db from '../db/index.js';
import logger from '../utils/logger.js';
import websocket from './websocket.js';

const CHAT_BLOCKED_STATES = ['DISPUTE_OPENED', 'DISPUTE_REFUND_PENDING', 'DISPUTE_RELEASE_PENDING'];

/**
 * Verify the caller is a participant on this transaction.
 * @returns {{ tx, role: 'user'|'trader', participantId: string }}
 */
async function assertParticipant(transactionId, { userId = null, traderId = null }) {
  const result = await db.query(
    `SELECT id, user_id, trader_id, state FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = result.rows[0];
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }

  if (userId && tx.user_id === userId) {
    return { tx, role: 'user', participantId: userId };
  }
  if (traderId && tx.trader_id === traderId) {
    return { tx, role: 'trader', participantId: traderId };
  }

  const err = new Error('Not authorized for this order chat');
  err.statusCode = 403;
  throw err;
}

function isChatLocked(state) {
  return CHAT_BLOCKED_STATES.includes(state);
}

async function listMessages(transactionId, { userId = null, traderId = null, adminId = null }, { limit = 100, before = null } = {}) {
  if (adminId) {
    const txResult = await db.query(`SELECT id FROM transactions WHERE id = $1`, [transactionId]);
    if (!txResult.rows[0]) {
      const err = new Error('Transaction not found');
      err.statusCode = 404;
      throw err;
    }
  } else {
    await assertParticipant(transactionId, { userId, traderId });
  }

  const params = [transactionId];
  let query = `
    SELECT id, transaction_id, sender_role, sender_id, message, type, image_url, created_at
    FROM chat_messages
    WHERE transaction_id = $1
  `;
  if (before) {
    params.push(before);
    query += ` AND created_at < $${params.length}`;
  }
  params.push(Math.min(limit, 200));
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await db.query(query, params);
  return result.rows.reverse();
}

async function sendMessage(transactionId, { userId = null, traderId = null }, { message, type = 'text', imageUrl = null }) {
  const { tx, role, participantId } = await assertParticipant(transactionId, { userId, traderId });

  if (isChatLocked(tx.state)) {
    const err = new Error('Chat is locked while this order is in dispute');
    err.statusCode = 409;
    throw err;
  }

  if (type === 'text') {
    const text = (message || '').trim();
    if (!text) {
      const err = new Error('Message is required');
      err.statusCode = 400;
      throw err;
    }
  } else if (type === 'image') {
    if (!imageUrl) {
      const err = new Error('Image URL is required');
      err.statusCode = 400;
      throw err;
    }
  } else {
    const err = new Error('Invalid message type');
    err.statusCode = 400;
    throw err;
  }

  const insert = await db.query(
    `INSERT INTO chat_messages (transaction_id, sender_role, sender_id, message, type, image_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [transactionId, role, participantId, message?.trim() || null, type, imageUrl]
  );
  const row = insert.rows[0];

  const payload = {
    id: row.id,
    transactionId: row.transaction_id,
    senderRole: row.sender_role,
    senderId: row.sender_id,
    message: row.message,
    type: row.type,
    imageUrl: row.image_url,
    createdAt: row.created_at,
  };

  websocket.emitToOrder(transactionId, 'chat_message', payload);
  return row;
}

/**
 * System messages on state transitions (escrow locked, payout sent, etc.)
 */
async function sendSystemMessage(transactionId, message) {
  if (!transactionId || !message) return null;

  const insert = await db.query(
    `INSERT INTO chat_messages (transaction_id, sender_role, sender_id, message, type)
     VALUES ($1, 'system', NULL, $2, 'system')
     RETURNING *`,
    [transactionId, message]
  );
  const row = insert.rows[0];

  websocket.emitToOrder(transactionId, 'chat_message', {
    id: row.id,
    transactionId: row.transaction_id,
    senderRole: 'system',
    senderId: null,
    message: row.message,
    type: 'system',
    imageUrl: null,
    createdAt: row.created_at,
  });

  return row;
}

export default {
  assertParticipant,
  isChatLocked,
  listMessages,
  sendMessage,
  sendSystemMessage,
};
