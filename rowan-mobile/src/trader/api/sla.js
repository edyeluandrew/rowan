import client from './client';

/** GET /api/v1/trader/sla */
export async function getSlaPerformance(period = '30d') {
  const { data } = await client.get('/api/v1/trader/sla', {
    params: { period },
  });
  return data;
}

/** GET /api/v1/trader/performance/networks */
export async function getNetworkPerformance() {
  const { data } = await client.get('/api/v1/trader/performance/networks');
  return data;
}

/** GET /api/v1/trader/float/health */
export async function getFloatHealth() {
  const { data } = await client.get('/api/v1/trader/float/health');
  return data;
}
