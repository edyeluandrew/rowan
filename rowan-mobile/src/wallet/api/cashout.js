import client from './client'

export function getQuote({ xlmAmount, network, phoneHash }) {
  console.log('[API] getQuote called with:', { xlmAmount, network, phoneHash, xlmType: typeof xlmAmount })
  
  return client.post('/api/v1/cashout/quote', {
    xlmAmount: Number(xlmAmount),  // Ensure it's a number
    network,
    phoneHash,
  }).then(res => {
    console.log('[API] ✅ getQuote response:', res.data)
    return res.data
  }).catch(err => {
    console.error('[API] ❌ getQuote error:', err.response?.data || err.message)
    throw err
  })
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
