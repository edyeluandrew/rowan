import client from './client'

export function getChallenge(stellarAddress) {
  return client.get('/api/v1/auth/challenge', {
    params: { stellarAddress },
  })
}

export function register({ stellarAddress, signature, nonce, phoneHash }) {
  return client.post('/api/v1/auth/register', {
    stellarAddress,
    signature,
    nonce,
    phoneHash,
  })
}

export function login({ stellarAddress, signature, nonce }) {
  return client.post('/api/v1/auth/login', {
    stellarAddress,
    signature,
    nonce,
  })
}
