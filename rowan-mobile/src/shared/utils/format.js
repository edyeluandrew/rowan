/**
 * Shared formatting utilities — used by both wallet and trader modules.
 * Superset of functions from wallet/utils/format.js and frontend/utils/format.js.
 */

/**
 * Format a numeric amount with the currency prefix/suffix.
 * formatCurrency(1450000, 'UGX') → 'UGX 1,450,000'
 * formatCurrency(45.2, 'USDC')  → '45.20 USDC'
 */
export function formatCurrency(amount, currency) {
  const num = Number(amount);
  if (currency === 'USDC' || currency === 'XLM') {
    return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
  return `${currency} ${num.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Format XLM amount: "12.34 XLM" */
export function formatXlm(amount) {
  return `${Number(amount).toFixed(2)} XLM`;
}

/** Format USDC amount: "12.34 USDC" */
export function formatUsdc(amount) {
  return `${Number(amount).toFixed(2)} USDC`;
}

/** Format exchange rate: "1 XLM = UGX 5,400" */
export function formatRate(rate) {
  return Number(rate).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** DD MMM YYYY  e.g. 26 Feb 2025 */
export function formatDate(isoString) {
  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** DD MMM, HH:MM  e.g. 26 Feb, 14:30 */
export function formatDateTime(isoString) {
  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]}, ${hh}:${mm}`;
}

/** Relative time: "2 minutes ago", "1 hour ago", "Yesterday" */
export function formatTimeAgo(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} minute${m > 1 ? 's' : ''} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} hour${h > 1 ? 's' : ''} ago`;
  }
  if (diff < 172800) return 'Yesterday';
  const da = Math.floor(diff / 86400);
  return `${da} days ago`;
}

/** Truncate a Stellar address: GABCDE...VWXYZ1 */
export function formatAddress(address) {
  if (!address || address.length < 12) return address || '';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}
