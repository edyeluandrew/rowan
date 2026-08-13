import client from './client'

function unwrap(res) {
  return res.data?.data ?? res.data
}

export function getUtilityConfig() {
  return client.get('/api/v1/utilities/config').then(unwrap)
}

export function getUtilityDataAvailability(country) {
  return client
    .get('/api/v1/utilities/data-availability', { params: { country } })
    .then(unwrap)
}

export function getUtilityLimits(params) {
  return client
    .get('/api/v1/utilities/limits', { params })
    .then(unwrap)
}

export function getUtilityOperators(country) {
  return client
    .get('/api/v1/utilities/operators', { params: { country } })
    .then(unwrap)
}

export function getUtilityBundles(params) {
  return client
    .get('/api/v1/utilities/bundles', { params })
    .then(unwrap)
}

export function getUtilityQuote(body) {
  return client.post('/api/v1/utilities/quote', body).then((res) => {
    const q = unwrap(res)
    return {
      ...q,
      quoteId: q.id,
    }
  })
}

export function completeUtilityPurchase({ quoteId, paymentTxHash }) {
  return client
    .post('/api/v1/utilities/purchase', {
      quoteId,
      ...(paymentTxHash ? { paymentTxHash } : {}),
    })
    .then(unwrap)
}

export function getUtilityPurchase(purchaseId) {
  return client
    .get(`/api/v1/utilities/purchase/${purchaseId}`)
    .then(unwrap)
}

export function getUtilityHistory(limit = 20) {
  return client
    .get('/api/v1/utilities/history', { params: { limit } })
    .then(unwrap)
}

export function getUtilityBillers(country) {
  return client
    .get('/api/v1/utilities/billers', { params: { country } })
    .then(unwrap)
}

export function getUtilityBillLookup({ billerId, subscriberAccount, fiatAmount, serviceType, area }) {
  return client
    .get('/api/v1/utilities/bill-lookup', {
      params: { billerId, subscriberAccount, fiatAmount, serviceType, area },
    })
    .then(unwrap)
}

export function getUtilityBillBouquets(utilityCode) {
  return client
    .get('/api/v1/utilities/bill-bouquets', { params: { utilityCode } })
    .then(unwrap)
}

export function getUtilityBillDelivery(purchaseId) {
  return client
    .get(`/api/v1/utilities/purchase/${purchaseId}/delivery`)
    .then(unwrap)
}
