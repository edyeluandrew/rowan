import client from '../api/client'

export function getDispute(disputeId) {
  return client.get(`/api/v1/trader/disputes/${disputeId}`).then((res) => res.data)
}

export function respondToDispute(disputeId, responseText, proofFile = null) {
  const form = new FormData()
  form.append('responseText', responseText)
  if (proofFile) {
    form.append('paymentProof', proofFile)
  }
  return client.post(`/api/v1/trader/disputes/${disputeId}/respond`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data)
}

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
