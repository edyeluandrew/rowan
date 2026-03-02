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
