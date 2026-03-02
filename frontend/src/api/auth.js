import client from './client';

/** POST /api/v1/trader/login */
export async function loginTrader(email, password) {
  const { data } = await client.post('/api/v1/trader/login', { email, password });
  return data;
}

/** POST /api/v1/auth/trader/signup */
export async function signupTrader(name, email, password) {
  const { data } = await client.post('/api/v1/auth/trader/signup', { name, email, password });
  return data;
}
