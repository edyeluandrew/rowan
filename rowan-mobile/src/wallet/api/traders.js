import client from './client'

export function listTraderAds(params = {}) {
  return client.get('/api/v1/traders/ads', { params }).then((res) => res.data)
}

export function getTraderAd(payoutSettingId) {
  return client.get(`/api/v1/traders/ads/${payoutSettingId}`).then((res) => res.data?.data)
}

export function getTraderProfile(traderId) {
  return client.get(`/api/v1/traders/${traderId}/profile`).then((res) => res.data?.data)
}

export function getTraderReviews(traderId, params = {}) {
  return client.get(`/api/v1/traders/${traderId}/reviews`, { params }).then((res) => res.data)
}
