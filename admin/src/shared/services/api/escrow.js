import client from '../client'

export function getEscrowStatus() {
  return client.get('/api/v1/admin/escrow/status')
}

export function getEscrowTransactions() {
  return client.get('/api/v1/admin/escrow/transactions')
}
