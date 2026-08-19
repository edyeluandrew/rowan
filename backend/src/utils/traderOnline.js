/**
 * Trader online status helpers (5-minute window).
 * Presence is last_seen_at (socket + authenticated API), not a manual toggle.
 */

import db from '../db/index.js';
import logger from './logger.js';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const TOUCH_MIN_MS = 20 * 1000;
const lastTouchMs = new Map();

export function isTraderOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const ts = new Date(lastSeenAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= ONLINE_WINDOW_MS;
}

/** Mark the trader present. Throttled so marketplace "Online" does not depend on sockets. */
export function touchTraderPresence(traderId) {
  if (!traderId) return;
  const now = Date.now();
  if (now - (lastTouchMs.get(traderId) || 0) < TOUCH_MIN_MS) return;
  lastTouchMs.set(traderId, now);
  db.query(`UPDATE traders SET last_seen_at = NOW() WHERE id = $1`, [traderId]).catch((err) => {
    logger.warn(`[TraderOnline] last_seen update failed: ${err.message}`);
  });
}

export function formatLastSeenLabel(lastSeenAt) {
  if (!lastSeenAt) return 'Offline';
  if (isTraderOnline(lastSeenAt)) return 'Online now';

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  if (diffMs < ONE_HOUR_MS) {
    const mins = Math.max(1, Math.floor(diffMs / 60000));
    return `Active ${mins} min${mins === 1 ? '' : 's'} ago`;
  }
  if (diffMs < ONE_DAY_MS) {
    return 'Active today';
  }
  const days = Math.max(1, Math.floor(diffMs / ONE_DAY_MS));
  return `Active ${days} day${days === 1 ? '' : 's'} ago`;
}

export { ONLINE_WINDOW_MS };
