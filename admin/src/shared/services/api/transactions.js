import client from '../client'

export function getTransactions(params) {
  return client.get('/api/v1/admin/transactions', { params })
}

export function getTransaction(id) {
  return client.get(`/api/v1/admin/transactions/${id}`)
}

export function forceRefund(id) {
  return client.post(`/api/v1/admin/transactions/${id}/force-refund`)
}

export function forceComplete(id) {
  return client.post(`/api/v1/admin/transactions/${id}/force-complete`)
}

export function reassignTrader(id, traderId) {
  return client.post(`/api/v1/admin/transactions/${id}/reassign`, { traderId })
}
