import client from '../client'

export function getSystemHealth() {
  return client.get('/api/v1/admin/system/health')
}

export function getReconciliation() {
  return client.get('/api/v1/admin/reconciliation')
}

export function getSystemAlerts() {
  return client.get('/api/v1/admin/system/alerts')
}

export function resolveAlert(id) {
  return client.post(`/api/v1/admin/system/alerts/${id}/resolve`)
}

export function getFraudAlerts(params = {}) {
  return client.get('/api/v1/admin/fraud-alerts', { params })
}

export function acknowledgeFraudAlert(id) {
  return client.post(`/api/v1/admin/fraud-alerts/${id}/acknowledge`)
}

export function getKycSubmissions(params = {}) {
  return client.get('/api/v1/admin/kyc-submissions', { params })
}

export function approveKycSubmission(id) {
  return client.post(`/api/v1/admin/kyc-submissions/${id}/approve`)
}

export function rejectKycSubmission(id, reason) {
  return client.post(`/api/v1/admin/kyc-submissions/${id}/reject`, { reason })
}

export function screenName(payload) {
  return client.post('/api/v1/admin/screening/check', payload)
}

export function getScreeningChecks(params = {}) {
  return client.get('/api/v1/admin/screening/checks', { params })
}

export function getSanctionsList(params = {}) {
  return client.get('/api/v1/admin/sanctions', { params })
}

export function addSanctionsEntity(payload) {
  return client.post('/api/v1/admin/sanctions', payload)
}

export function removeSanctionsEntity(id) {
  return client.delete(`/api/v1/admin/sanctions/${id}`)
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
