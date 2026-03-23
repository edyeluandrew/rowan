import client from './client';

/** GET /api/v1/trader/wallet */
export async function getWallet() {
  const { data } = await client.get('/api/v1/trader/wallet');
  return data;
}

/** POST /api/v1/trader/wallet/verify */
export async function verifyWalletAddress(stellarAddress) {
  const { data } = await client.post('/api/v1/trader/wallet/verify', { stellarAddress });
  return data;
}
