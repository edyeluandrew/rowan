import db from '../db/index.js';
import traderStatsService from './traderStatsService.js';

async function assertCanReview(transactionId, reviewerId, reviewerRole) {
  const txResult = await db.query(
    `SELECT id, user_id, trader_id, state FROM transactions WHERE id = $1`,
    [transactionId]
  );
  const tx = txResult.rows[0];
  if (!tx) {
    const err = new Error('Transaction not found');
    err.statusCode = 404;
    throw err;
  }
  if (tx.state !== 'COMPLETE') {
    const err = new Error('Reviews can only be submitted after the order is complete');
    err.statusCode = 409;
    throw err;
  }

  if (reviewerRole === 'user') {
    if (tx.user_id !== reviewerId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return { tx, revieweeId: tx.trader_id };
  }

  if (reviewerRole === 'trader') {
    if (tx.trader_id !== reviewerId) {
      const err = new Error('Not authorized');
      err.statusCode = 403;
      throw err;
    }
    return { tx, revieweeId: tx.user_id };
  }

  const err = new Error('Invalid reviewer role');
  err.statusCode = 400;
  throw err;
}

async function createReview({ transactionId, reviewerId, reviewerRole, rating, comment = null }) {
  if (![1, -1].includes(rating)) {
    const err = new Error('Rating must be 1 (positive) or -1 (negative)');
    err.statusCode = 400;
    throw err;
  }

  const { revieweeId } = await assertCanReview(transactionId, reviewerId, reviewerRole);

  if (!revieweeId) {
    const err = new Error('Cannot review — counterparty not assigned');
    err.statusCode = 409;
    throw err;
  }

  try {
    const result = await db.query(
      `INSERT INTO reviews (transaction_id, reviewer_id, reviewer_role, reviewee_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [transactionId, reviewerId, reviewerRole, revieweeId, rating, comment?.trim() || null]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const dup = new Error('You have already reviewed this transaction');
      dup.statusCode = 409;
      throw dup;
    }
    throw err;
  }
}

async function listReviewsForTrader(traderId, { page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * Math.min(limit, 50);
  const result = await db.query(
    `SELECT id, transaction_id, rating, comment, reviewer_role, created_at
     FROM reviews
     WHERE reviewee_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [traderId, Math.min(limit, 50), offset]
  );

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM reviews WHERE reviewee_id = $1`,
    [traderId]
  );

  const stats = await traderStatsService.getTraderStats(traderId);

  return {
    reviews: result.rows.map((r) => ({
      id: r.id,
      transactionId: r.transaction_id,
      rating: r.rating,
      comment: r.comment,
      reviewerRole: r.reviewer_role,
      createdAt: r.created_at,
    })),
    total: countResult.rows[0]?.total || 0,
    page: Math.max(1, page),
    stats,
  };
}

async function getReviewStatus(transactionId, reviewerId, reviewerRole) {
  const result = await db.query(
    `SELECT id FROM reviews
     WHERE transaction_id = $1 AND reviewer_id = $2 AND reviewer_role = $3`,
    [transactionId, reviewerId, reviewerRole]
  );
  return { submitted: result.rows.length > 0 };
}

export default {
  createReview,
  listReviewsForTrader,
  getReviewStatus,
};
