import client from '../client'

export function getUsers(params = {}) {
  return client.get('/api/v1/admin/users', { params })
}

export function getUser(id) {
  return client.get(`/api/v1/admin/users/${id}`)
}

export function freezeUser(id, reason) {
  return client.post(`/api/v1/admin/users/${id}/freeze`, { reason })
}

export function unfreezeUser(id) {
  return client.post(`/api/v1/admin/users/${id}/unfreeze`)
}
