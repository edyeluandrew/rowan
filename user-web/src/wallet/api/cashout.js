import client from './client'

export function getQuote({ xlmAmount, fiatAmount, network, phoneHash, payoutPhone, payoutName, payoutSettingId }) {
  const body = {
    network,
    phoneHash,
    payoutPhone,
    payoutName,
    ...(payoutSettingId ? { payoutSettingId } : {}),
  }
  if (fiatAmount != null) {
    body.fiatAmount = Number(fiatAmount)
  } else {
    body.xlmAmount = Number(xlmAmount)
  }

  return client.post('/api/v1/cashout/quote', body).then(res => res.data).catch(err => {
    console.error('[API] getQuote error:', err.response?.data || err.message)
    throw err
  })
}

export function confirmQuote({ quoteId, stellarTxHash }) {
  return client.post('/api/v1/cashout/confirm', { quoteId, stellarTxHash }).then(res => res.data)
}

export function getTransactionStatus(transactionId) {
  return client.get(`/api/v1/cashout/status/${transactionId}`).then(res => res.data)
}

// Canonical dispute endpoint. The legacy POST /api/v1/cashout/dispute was
// removed (it relied on the obsolete FIAT_SENT state); both entry points now
// open disputes via the per-transaction user route.
export function fileDispute({ transactionId, reason, description }) {
  return client.post(`/api/v1/user/transactions/${transactionId}/dispute`, {
    reason: description ? `${reason}: ${description}` : reason,
  }).then(res => res.data)
}

export function getTransactionReceipt(transactionId) {
  return client.get(`/api/v1/cashout/receipt/${transactionId}`).then(res => res.data)
}

export function confirmReceipt(transactionId) {
  return client.post(`/api/v1/user/transactions/${transactionId}/confirm-receipt`).then(res => res.data)
}

export function openDispute(transactionId, reason) {
  return client.post(`/api/v1/user/transactions/${transactionId}/dispute`, { reason }).then(res => res.data)
}

export function cancelOrder(transactionId) {
  return client.post(`/api/v1/user/transactions/${transactionId}/cancel`).then(res => res.data)
}
