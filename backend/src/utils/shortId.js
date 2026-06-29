/**
 * Human-readable order reference: ROW-A1B2C3D4
 */
export function formatShortId(transactionId) {
  if (!transactionId || typeof transactionId !== 'string') return 'ROW-????????';
  return `ROW-${transactionId.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
}

export default { formatShortId };
