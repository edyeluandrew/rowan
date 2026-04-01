import client from '../client'

export function adminLogin(email, password) {
  return client.post('/api/v1/auth/admin/login', { email, password })
}

export function adminLogout() {
  return client.post('/api/v1/admin/auth/logout')
}
