import client from './client';

/** GET /api/v1/trader/requests  ?status=pending|active */
export async function getRequests(status) {
  const { data } = await client.get('/api/v1/trader/requests', { params: { status } });
  return data;
}

/** GET /api/v1/trader/requests/:id */
export async function getRequest(id) {
  const { data } = await client.get(`/api/v1/trader/requests/${id}`);
  return data;
}

/** POST /api/v1/trader/requests/:id/accept */
export async function acceptRequest(id) {
  const { data } = await client.post(`/api/v1/trader/requests/${id}/accept`);
  return data;
}

/** POST /api/v1/trader/requests/:id/decline */
export async function declineRequest(id) {
  const { data } = await client.post(`/api/v1/trader/requests/${id}/decline`);
  return data;
}

/** POST /api/v1/trader/requests/:id/confirm */
export async function confirmRequest(id) {
  const { data } = await client.post(`/api/v1/trader/requests/${id}/confirm`);
  return data;
}

/** GET /api/v1/trader/stats */
export async function getStats() {
  const { data } = await client.get('/api/v1/trader/stats');
  return data;
}

/** GET /api/v1/trader/history?page=&limit= */
export async function getHistory(page = 1, limit = 20) {
  const { data } = await client.get('/api/v1/trader/history', { params: { page, limit } });
  return data;
}

/** PUT /api/v1/trader/float */
export async function updateFloat(currency, amount) {
  const { data } = await client.put('/api/v1/trader/float', { currency, amount });
  return data;
}

/** GET /api/v1/trader/profile */
export async function getProfile() {
  const { data } = await client.get('/api/v1/trader/profile');
  return data;
}

/** GET /api/v1/rates/current */
export async function getRates() {
  const { data } = await client.get('/api/v1/rates/current');
  return data;
}
