/**
 * Format Reloadly utility billers for Rowan clients.
 */

export function formatBiller(row) {
  if (!row) return null;
  const id = row.id ?? row.billerId;
  return {
    id: String(id),
    name: row.name,
    countryCode: row.countryIsoCode || row.countryISOCode,
    type: row.type,
    serviceType: row.serviceType,
    currency: row.localTransactionCurrencyCode || 'UGX',
    minAmount: row.minLocalTransactionAmount != null
      ? Number(row.minLocalTransactionAmount)
      : null,
    maxAmount: row.maxLocalTransactionAmount != null
      ? Number(row.maxLocalTransactionAmount)
      : null,
    localAmountSupported: row.localAmountSupported !== false,
  };
}

export function normalizeBillersResponse(body) {
  const rows = body?.content || body?.data || (Array.isArray(body) ? body : []);
  return rows.map(formatBiller).filter(Boolean);
}

export default { formatBiller, normalizeBillersResponse };
