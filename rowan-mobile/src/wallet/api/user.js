import client from './client'

export async function getProfile() {
  const { data } = await client.get('/api/v1/user/profile')
  return data
}

export async function getHistory({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit
  const { data } = await client.get('/api/v1/user/history', {
    params: { limit, offset },
  })
  return data
}

export function getNotifications({ page = 1, limit = 20 } = {}) {
  return client.get('/api/v1/user/notifications', {
    params: { page, limit },
  })
}

export function markNotificationsRead(notificationIds) {
  return client.post('/api/v1/user/notifications/mark-read', {
    notificationIds,
  })
}

export function markAllNotificationsRead() {
  return client.post('/api/v1/user/notifications/mark-all-read')
}

export async function getRateAlerts() {
  const { data } = await client.get('/api/v1/user/rate-alerts')
  return data
}

export async function createRateAlert({ pair, direction, targetRate }) {
  const { data } = await client.post('/api/v1/user/rate-alerts', { pair, direction, targetRate })
  return data
}

export async function deleteRateAlert(alertId) {
  const { data } = await client.delete(`/api/v1/user/rate-alerts/${alertId}`)
  return data
}

export async function updateRateAlert(alertId, updates) {
  const { data } = await client.patch(`/api/v1/user/rate-alerts/${alertId}`, updates)
  return data
}

export function registerPushToken(token) {
  return client.post('/api/v1/user/push-token', { token })
}
