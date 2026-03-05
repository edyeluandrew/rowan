import client from './client'

export function getProfile() {
  return client.get('/api/v1/user/profile')
}

export function getHistory({ page = 1, limit = 20 } = {}) {
  return client.get('/api/v1/user/history', {
    params: { page, limit },
  })
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

export function getRateAlerts() {
  return client.get('/api/v1/user/rate-alerts')
}

export function createRateAlert({ pair, direction, targetRate }) {
  return client.post('/api/v1/user/rate-alerts', { pair, direction, targetRate })
}

export function deleteRateAlert(alertId) {
  return client.delete(`/api/v1/user/rate-alerts/${alertId}`)
}

export function updateRateAlert(alertId, updates) {
  return client.patch(`/api/v1/user/rate-alerts/${alertId}`, updates)
}

export function registerPushToken(token) {
  return client.post('/api/v1/user/push-token', { token })
}
