import client from './client'

export function getQuote({ xlmAmount, network, phoneHash }) {
  return client.post('/api/v1/cashout/quote', {
    xlmAmount,
    network,
    phoneHash,
  }).then(res => res.data)
}

export function confirmQuote({ quoteId, stellarTxHash }) {
  return client.post('/api/v1/cashout/confirm', { quoteId, stellarTxHash }).then(res => res.data)
}

export function getTransactionStatus(transactionId) {
  return client.get(`/api/v1/cashout/status/${transactionId}`).then(res => res.data)
}

export function fileDispute({ transactionId, reason, description }) {
  return client.post('/api/v1/cashout/dispute', {
    transactionId,
    reason,
    description,
  }).then(res => res.data)
}

export function getTransactionReceipt(transactionId) {
  return client.get(`/api/v1/cashout/receipt/${transactionId}`).then(res => res.data)
}
