import client from './client'

export function getQuote({ xlmAmount, network, phoneHash }) {
  return client.post('/api/v1/cashout/quote', {
    xlmAmount,
    network,
    phoneHash,
  })
}

export function confirmQuote(quoteId) {
  return client.post('/api/v1/cashout/confirm', { quoteId })
}

export function getTransactionStatus(transactionId) {
  return client.get(`/api/v1/cashout/status/${transactionId}`)
}

export function fileDispute({ transactionId, reason, description }) {
  return client.post('/api/v1/cashout/dispute', {
    transactionId,
    reason,
    description,
  })
}
