import client from '../client'

export function getTraders(params) {
  return client.get('/api/v1/admin/traders', { params })
}

export function getTrader(id) {
  return client.get(`/api/v1/admin/traders/${id}`)
}

export function approveTrader(id) {
  return client.post(`/api/v1/admin/traders/${id}/verify`, {})
}

export function suspendTrader(id, reason) {
  return client.put(`/api/v1/admin/traders/${id}/suspend`, { suspended: true, reason })
}

export function reactivateTrader(id) {
  return client.put(`/api/v1/admin/traders/${id}/suspend`, { suspended: false })
}

export function updateTraderLimits(id, limits) {
  return client.patch(`/api/v1/admin/traders/${id}/limits`, limits)
}

export function adjustFloat(id, data) {
  return client.post(`/api/v1/admin/traders/${id}/adjust-float`, data)
}
