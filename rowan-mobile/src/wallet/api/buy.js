import client from './client'

export function getBuyQuote({ fiatAmount, network, phoneHash, payoutSettingId }) {
  return client.post('/api/v1/buy/quote', {
    fiatAmount: Number(fiatAmount),
    network,
    phoneHash,
    payoutSettingId,
  }).then((res) => res.data)
}

export function confirmBuyOrder({ quoteId }) {
  return client.post('/api/v1/buy/confirm', { quoteId }).then((res) => res.data)
}

export function submitBuyPayment({ transactionId, paymentReference, proofFile }) {
  if (!proofFile) {
    return client.post('/api/v1/buy/payment-sent', {
      transactionId,
      paymentReference,
    }).then((res) => res.data)
  }
  const form = new FormData()
  form.append('transactionId', transactionId)
  form.append('paymentReference', paymentReference)
  form.append('proof', proofFile)
  return client.post('/api/v1/buy/payment-sent', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data)
}

export function getBuyTransactionStatus(transactionId) {
  return client.get(`/api/v1/buy/status/${transactionId}`).then((res) => res.data)
}
