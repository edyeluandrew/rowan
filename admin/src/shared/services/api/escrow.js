import client from '../client'

export function getEscrowStatus() {
  return client.get('/api/v1/admin/escrow/status')
}

export function getEscrowTransactions() {
  return client.get('/api/v1/admin/escrow/transactions')
}

export function getPendingRefunds(params = {}) {
  return client.get('/api/v1/admin/escrow/pending-refunds', { params })
}

export function retryRefund(transactionId, reason) {
  return client.post(`/api/v1/admin/escrow/refund-retry/${transactionId}`, { reason })
}

