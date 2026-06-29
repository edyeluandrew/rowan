import client from './client'

export function submitTraderReview({ transactionId, rating, comment }) {
  return client.post('/api/v1/reviews/trader', { transactionId, rating, comment }).then((res) => res.data)
}

export function getTraderReviewStatus(transactionId) {
  return client.get(`/api/v1/reviews/trader/status/${transactionId}`).then((res) => res.data?.data)
}
