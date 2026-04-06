import client from '../client'

export function getAuditLogs(params) {
  return client.get('/api/v1/admin/audit-logs', { params })
}

export function getAuditLog(id) {
  return client.get(`/api/v1/admin/audit-logs/${id}`)
}

export function logAdminAction(action, details) {
  return client.post('/api/v1/admin/audit-log', { action, details })
}
