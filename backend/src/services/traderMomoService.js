import db from '../db/index.js';

function formatFiatDisplay(amount, currency = 'UGX') {
  const n = parseFloat(amount);
  if (!Number.isFinite(n)) return `${currency} 0`;
  return `${currency} ${Math.round(n).toLocaleString('en-US')}`;
}

/**
 * Verified MoMo account for a trader on a given network (used in buy flow).
 */
export async function getVerifiedTraderMomo(traderId, network) {
  if (!traderId || !network) return null;

  const result = await db.query(
    `SELECT phone_number, account_name, network
     FROM trader_momo_accounts
     WHERE trader_id = $1 AND network = $2 AND verification_status = 'PASSED'
     ORDER BY verified_at DESC NULLS LAST
     LIMIT 1`,
    [traderId, network]
  );

  return result.rows[0] || null;
}

export function buildBuyPaymentDetailsPayload(tx, traderMomo) {
  const ref = tx.id ? `ROW-${tx.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'ROW';
  const currency = tx.fiat_currency || 'UGX';
  return {
    role: 'trader_receive',
    network: tx.network,
    account_number: traderMomo?.phone_number || '',
    account_name: traderMomo?.account_name || 'Trader',
    amount: formatFiatDisplay(tx.fiat_amount, currency),
    reference: ref,
  };
}
