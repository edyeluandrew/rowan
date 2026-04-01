import client from '../client'

export function getDisputes(params) {
  return client.get('/api/v1/admin/disputes', { params })
}

export function getDispute(id) {
  return client.get(`/api/v1/admin/disputes/${id}`)
}

export function resolveDispute(id, data) {
  return client.post(`/api/v1/admin/disputes/${id}/resolve`, data)
}

export function escalateDispute(id, reason) {
  return client.post(`/api/v1/admin/disputes/${id}/escalate`, { reason })
}

export function addDisputeNote(id, note) {
  return client.post(`/api/v1/admin/disputes/${id}/note`, { note })
}
