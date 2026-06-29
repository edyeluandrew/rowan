import client from '../api/client'

export function uploadTraderDisputeEvidence(disputeId, file) {
  const form = new FormData()
  form.append('file', file)
  return client.post(`/api/v1/trader/disputes/${disputeId}/evidence`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data?.evidence)
}

export function listTraderDisputeEvidence(disputeId) {
  return client.get(`/api/v1/trader/disputes/${disputeId}/evidence`).then((res) => res.data?.evidence || [])
}
