import client from '../client'

export function getTraders(params) {
  return client.get('/api/v1/admin/traders', { params })
}

export function getTrader(id) {
  return client.get(`/api/v1/admin/traders/${id}`)
}

export function approveTrader(id) {
  return client.post(`/api/v1/admin/traders/${id}/approve`)
}

export function suspendTrader(id, reason) {
  return client.post(`/api/v1/admin/traders/${id}/suspend`, { reason })
}

export function reactivateTrader(id) {
  return client.post(`/api/v1/admin/traders/${id}/reactivate`)
}

export function updateTraderLimits(id, limits) {
  return client.patch(`/api/v1/admin/traders/${id}/limits`, limits)
}

export function adjustFloat(id, data) {
  return client.post(`/api/v1/admin/traders/${id}/adjust-float`, data)
}
