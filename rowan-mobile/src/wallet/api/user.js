import client from './client'

export function cancelOrder(transactionId) {
  return client.post(`/api/v1/user/transactions/${transactionId}/cancel`).then((res) => res.data)
}

export function blockTrader(traderId) {
  return client.post(`/api/v1/user/blocked-traders/${traderId}`).then((res) => res.data)
}

export function unblockTrader(traderId) {
  return client.delete(`/api/v1/user/blocked-traders/${traderId}`).then((res) => res.data)
}

export function listBlockedTraders() {
  return client.get('/api/v1/user/blocked-traders').then((res) => res.data?.blockedTraders || [])
}

export function uploadDisputeEvidence(disputeId, file) {
  const form = new FormData()
  form.append('file', file)
  return client.post(`/api/v1/user/disputes/${disputeId}/evidence`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((res) => res.data?.evidence)
}

export function listDisputeEvidence(disputeId) {
  return client.get(`/api/v1/user/disputes/${disputeId}/evidence`).then((res) => res.data?.evidence || [])
}

export function getActiveTransaction() {
  return client.get('/api/v1/user/transactions/active').then((res) => res.data)
}

export function getTransactionHistory(params = {}) {
  return client.get('/api/v1/user/transactions/history', { params }).then((res) => res.data)
}

export function getNotifications({ page = 1, limit = 20 } = {}) {
  return client.get('/api/v1/user/notifications', { params: { page, limit } }).then((res) => res.data)
}

export function getUnreadNotificationCount() {
  return client.get('/api/v1/user/notifications/unread').then((res) => res.data?.count ?? 0)
}

export function markNotificationsRead(notificationIds) {
  if (notificationIds.length === 1) {
    return client.patch(`/api/v1/user/notifications/${notificationIds[0]}/read`).then((res) => res.data)
  }
  return Promise.all(
    notificationIds.map((id) => client.patch(`/api/v1/user/notifications/${id}/read`))
  ).then(() => ({ success: true }))
}

export function markAllNotificationsRead() {
  return client.patch('/api/v1/user/notifications/read-all').then((res) => res.data)
}

export function getRateAlerts() {
  return client.get('/api/v1/user/rate-alerts').then((res) => res.data)
}

export function createRateAlert({ pair, direction, targetRate }) {
  return client.post('/api/v1/user/rate-alerts', { pair, direction, targetRate }).then((res) => res.data)
}

export function updateRateAlert(alertId, updates) {
  return client.patch(`/api/v1/user/rate-alerts/${alertId}`, updates).then((res) => res.data)
}

export function deleteRateAlert(alertId) {
  return client.delete(`/api/v1/user/rate-alerts/${alertId}`).then((res) => res.data)
}

/** @deprecated Use getTransactionHistory — kept for legacy callers */
export function getHistory(params = {}) {
  const page = params.page || 1
  const limit = params.limit || 20
  return client.get('/api/v1/user/history', {
    params: { limit, offset: (page - 1) * limit },
  }).then((res) => res.data)
}
