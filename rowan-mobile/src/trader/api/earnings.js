import client from './client';

/** GET /api/v1/trader/earnings */
export async function getEarnings(period = '30d') {
  const { data } = await client.get('/api/v1/trader/earnings', {
    params: { period },
  });
  return data;
}

/** GET /api/v1/trader/earnings/transactions */
export async function getEarningsTransactions(period = '30d', page = 1, limit = 10) {
  const { data } = await client.get('/api/v1/trader/earnings/transactions', {
    params: { period, page, limit },
  });
  return data;
}
