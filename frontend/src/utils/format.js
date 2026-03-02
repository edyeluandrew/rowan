/**
 * Format a numeric amount with the currency prefix.
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

/** Truncate a Stellar address: GABCDE...VWXYZ1 */
export function formatAddress(address) {
  if (!address || address.length < 12) return address || '';
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

/** Relative time: 2 minutes ago, 1 hour ago, Yesterday */
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
  const d = Math.floor(diff / 86400);
  return `${d} days ago`;
}
