/**
 * Trader online status helpers (5-minute window).
 */

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export function isTraderOnline(lastSeenAt) {
  if (!lastSeenAt) return false;
  const ts = new Date(lastSeenAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= ONLINE_WINDOW_MS;
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
