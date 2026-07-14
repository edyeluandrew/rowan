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

/**
 * Retry the on-chain USDC refund for a user-win dispute stuck in
 * DISPUTE_REFUND_PENDING (e.g. after the user adds a USDC trustline).
 */
export function retryDisputeRefund(id) {
  return client.post(`/api/v1/admin/disputes/${id}/retry-refund`)
}

export function getDisputeEvidence(disputeId) {
  return client.get(`/api/v1/admin/disputes/${disputeId}/evidence`).then((res) => res.evidence || [])
}
