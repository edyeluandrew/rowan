export const ACTION_TYPES = {
  'trader_approved': { label: 'Trader Approved', color: 'green' },
  'trader_suspended': { label: 'Trader Suspended', color: 'red' },
  'trader_reactivated': { label: 'Trader Reactivated', color: 'green' },
  'trader_verified': { label: 'Trader Verified', color: 'green' },
  'trader_limits_updated': { label: 'Limits Updated', color: 'blue' },
  'trader_float_adjusted': { label: 'Float Adjusted', color: 'blue' },
  'dispute_resolved': { label: 'Dispute Resolved', color: 'green' },
  'dispute_escalated': { label: 'Dispute Escalated', color: 'yellow' },
  'dispute_note_added': { label: 'Note Added', color: 'blue' },
  'transaction_force_refunded': { label: 'Transaction Refunded', color: 'orange' },
  'transaction_force_completed': { label: 'Transaction Completed', color: 'green' },
  'transaction_reassigned': { label: 'Transaction Reassigned', color: 'blue' },
  'rate_updated': { label: 'Rate Updated', color: 'blue' },
  'alert_resolved': { label: 'Alert Resolved', color: 'green' },
  'alert_created': { label: 'Alert Created', color: 'yellow' },
  'admin_login': { label: 'Admin Login', color: 'gray' },
  'admin_logout': { label: 'Admin Logout', color: 'gray' },
}

export const ACTION_TYPE_OPTIONS = Object.entries(ACTION_TYPES).map(([key, val]) => ({
  value: key,
  label: val.label,
}))

export const ENTITY_TYPES = {
  'trader': 'Trader',
  'transaction': 'Transaction',
  'dispute': 'Dispute',
  'escrow': 'Escrow',
  'rate': 'Rate',
  'alert': 'Alert',
  'admin': 'Admin',
  'system': 'System',
}

export const ENTITY_TYPE_OPTIONS = Object.entries(ENTITY_TYPES).map(([key, label]) => ({
  value: key,
  label,
}))
