import client from '../client'

export function getRevenue(params) {
  return client.get('/api/v1/admin/analytics/revenue', { params })
}

export function getVolume(params) {
  return client.get('/api/v1/admin/analytics/volume', { params })
}

export function getTraderPerformance() {
  return client.get('/api/v1/admin/analytics/traders')
}

export function getUserAnalytics() {
  return client.get('/api/v1/admin/analytics/users')
}
