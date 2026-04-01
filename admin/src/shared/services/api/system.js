import client from '../client'

export function getSystemHealth() {
  return client.get('/api/v1/admin/system/health')
}

export function getSystemAlerts() {
  return client.get('/api/v1/admin/system/alerts')
}

export function resolveAlert(id) {
  return client.post(`/api/v1/admin/system/alerts/${id}/resolve`)
}

export function getRates() {
  return client.get('/api/v1/admin/rates')
}

export function updateRates(data) {
  return client.patch('/api/v1/admin/rates', data)
}

/**
 * Log an admin action for audit trail.
 * Fire-and-forget — never blocks the calling action.
 */
export function logAdminAction(action, details = {}) {
  return client.post('/api/v1/admin/audit-log', { action, details }).catch(() => {
    /* audit log failure must not block operations */
  })
}
