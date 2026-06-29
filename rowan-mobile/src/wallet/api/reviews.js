import client from './client'

export function submitReview({ transactionId, rating, comment }) {
  return client.post('/api/v1/reviews', { transactionId, rating, comment }).then((res) => res.data)
}

export function getReviewStatus(transactionId) {
  return client.get(`/api/v1/reviews/status/${transactionId}`).then((res) => res.data?.data)
}
