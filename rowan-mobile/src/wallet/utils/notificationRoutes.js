/**
 * Map a notification (in-app or local push extra) to a wallet route.
 * Keeps in-app list taps and OS notification taps on the same path rules.
 */

const TERMINAL_TYPES = new Set([
  'COMPLETE',
  'TRANSACTION_COMPLETE',
  'TX_COMPLETE',
  'REFUNDED',
  'TRANSACTION_REFUNDED',
  'FAILED',
  'TRANSACTION_FAILED',
  'ORDER_CANCELLED',
])

const ACTIVE_TYPES = new Set([
  'TRADER_MATCHED',
  'FIAT_PAYOUT_SUBMITTED',
  'USER_CONFIRMATION_PENDING',
  'TRANSACTION_UPDATE',
  'PAYMENT_PROOF',
  'NEW_REQUEST',
  'DISPUTE_OPENED',
  'DISPUTE_RESOLVED',
  'DISPUTE_UPDATE',
  'APPEAL_EXPIRES_SOON',
])

function collectPayload(source = {}) {
  const data = source.data && typeof source.data === 'object' ? source.data : {}
  return { source, data }
}

export function getNotificationEntityId(source = {}) {
  const { data } = collectPayload(source)
  return (
    source.transactionId
    || source.transaction_id
    || data.transactionId
    || data.transaction_id
    || data.purchaseId
    || data.purchase_id
    || data.utilityPurchaseId
    || data.utility_purchase_id
    || data.id
    || null
  )
}

export function isUtilityNotification(source = {}) {
  const { data } = collectPayload(source)
  const type = String(source.type || data.type || '').toLowerCase()
  const kind = String(source.kind || data.kind || '').toLowerCase()
  if (kind === 'utility') return true
  if (data.utilityType || data.utility_type) return true
  if (type.includes('utility') || type.includes('airtime') || type.includes('data') || type.includes('bill')) {
    return true
  }
  return false
}

/**
 * @returns {string|null} absolute app path under /wallet, or null if nowhere to go
 */
export function resolveNotificationPath(notification) {
  if (!notification) return null
  const { data } = collectPayload(notification)
  const id = getNotificationEntityId(notification)
  const rawType = notification.type || notification.state || data.state || data.type || ''
  const type = String(rawType).toUpperCase()

  if (isUtilityNotification(notification)) {
    return id ? `/wallet/utilities/status/${id}` : '/wallet/history'
  }

  if (!id) {
    if (type === 'SYSTEM' || type === 'INFO') return null
    return null
  }

  if (TERMINAL_TYPES.has(type)) {
    return `/wallet/history/${id}`
  }

  if (type === 'DISPUTE_OPENED' || type === 'DISPUTE_UPDATE') {
    return `/wallet/transaction/${id}`
  }

  if (ACTIVE_TYPES.has(type) || type) {
    return `/wallet/transaction/${id}`
  }

  return `/wallet/transaction/${id}`
}

/**
 * Payload for Capacitor LocalNotifications.extra (and reverse of it).
 */
export function buildLocalNotificationExtra(eventName, data = {}) {
  return {
    type: eventName || data.state || data.type,
    state: data.state,
    transactionId: data.transactionId || data.transaction_id || data.id || null,
    kind: data.kind || 'p2p',
    ...data,
  }
}
