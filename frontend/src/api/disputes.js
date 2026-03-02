import client from './client';

/** GET /api/v1/trader/disputes */
export async function getDisputes() {
  const { data } = await client.get('/api/v1/trader/disputes');
  return data;
}

/** GET /api/v1/trader/disputes/:id */
export async function getDispute(id) {
  const { data } = await client.get(`/api/v1/trader/disputes/${id}`);
  return data;
}

/** POST /api/v1/trader/disputes/:id/respond — multipart/form-data */
export async function respondToDispute(id, responseText, paymentProofFile) {
  const form = new FormData();
  form.append('responseText', responseText);
  if (paymentProofFile) {
    form.append('paymentProof', paymentProofFile);
  }
  const { data } = await client.post(`/api/v1/trader/disputes/${id}/respond`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
