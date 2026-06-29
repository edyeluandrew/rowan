import db from '../db/index.js';

/**
 * Aggregate trader performance stats for marketplace ads and profile pages.
 */
async function getTraderStats(traderId) {
  const txStats = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE state = 'COMPLETE') AS completed_count,
       COUNT(*) FILTER (WHERE state IN ('COMPLETE', 'REFUNDED', 'FAILED')) AS settled_count,
       COUNT(*) FILTER (WHERE state IN ('TRADER_MATCHED', 'FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING')) AS active_count,
       AVG(
         EXTRACT(EPOCH FROM (completed_at - trader_matched_at)) / 60.0
       ) FILTER (WHERE state = 'COMPLETE' AND trader_matched_at IS NOT NULL AND completed_at IS NOT NULL) AS avg_release_minutes
     FROM transactions
     WHERE trader_id = $1`,
    [traderId]
  );

  const reviewStats = await db.query(
    `SELECT
       COUNT(*)::int AS review_count,
       COUNT(*) FILTER (WHERE rating = 1)::int AS positive_count,
       COUNT(*) FILTER (WHERE rating = -1)::int AS negative_count
     FROM reviews
     WHERE reviewee_id = $1`,
    [traderId]
  );

  const row = txStats.rows[0] || {};
  const reviews = reviewStats.rows[0] || {};
  const completed = parseInt(row.completed_count, 10) || 0;
  const settled = parseInt(row.settled_count, 10) || 0;
  const reviewCount = reviews.review_count || 0;
  const positiveCount = reviews.positive_count || 0;

  const completionRate = settled > 0 ? Math.round((completed / settled) * 1000) / 10 : null;
  const positivePercent = reviewCount > 0 ? Math.round((positiveCount / reviewCount) * 1000) / 10 : null;

  return {
    completedOrders: completed,
    completionRate,
    avgReleaseMinutes: row.avg_release_minutes != null
      ? Math.round(parseFloat(row.avg_release_minutes))
      : null,
    reviewCount,
    positivePercent,
  };
}

async function getRecentReviews(traderId, limit = 10) {
  const result = await db.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, r.reviewer_role
     FROM reviews r
     WHERE r.reviewee_id = $1
     ORDER BY r.created_at DESC
     LIMIT $2`,
    [traderId, Math.min(limit, 50)]
  );
  return result.rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    reviewerRole: row.reviewer_role,
  }));
}

export default {
  getTraderStats,
  getRecentReviews,
};
