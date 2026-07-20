import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Badge from '../../../shared/components/ui/Badge'
import { ACTION_TYPES, ENTITY_TYPES } from '../utils/constants'

function formatDateTime(date) {
  if (!date) return 'N/A'
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

function resolveEntityId(log) {
  return log.resource_id
    || log.entity_id
    || log.targetId
    || log.metadata?.traderId
    || log.metadata?.trader_id
    || log.metadata?.transactionId
    || log.metadata?.transaction_id
    || null
}

function resolveEntityType(log) {
  if (log.metadata?.traderId || log.metadata?.trader_id) return 'Trader'
  if (log.metadata?.transactionId || log.metadata?.transaction_id) return 'Transaction'
  if (log.metadata?.disputeId || log.metadata?.dispute_id) return 'Dispute'
  const raw = log.resource_type || log.entity_type || log.targetType
  if (!raw) return null
  return ENTITY_TYPES[raw] || raw
}

function resolveAdminLabel(log) {
  if (log.admin_email) return log.admin_email
  if (log.admin_id) return `${log.admin_id.substring(0, 8)}...`
  if (log.adminId) return `${log.adminId.substring(0, 8)}...`
  return 'Unknown'
}

function resolveNotes(log) {
  return log.metadata?.notes
    || log.metadata?.reason
    || log.details?.reason
    || log.details?.message
    || log.new_value?.verification_status
    || '-'
}

export default function AuditLogRow({ log }) {
  const [expanded, setExpanded] = useState(false)

  const actionConfig = ACTION_TYPES[log.action] || {
    label: log.action?.replace(/_/g, ' ') || 'Unknown',
    color: 'gray',
  }

  const entityType = resolveEntityType(log)
  const entityId = resolveEntityId(log)
  const detailPayload = {
    ...(log.metadata || {}),
    ...(log.details || {}),
    ...(Object.keys(log.old_value || {}).length ? { old_value: log.old_value } : {}),
    ...(Object.keys(log.new_value || {}).length ? { new_value: log.new_value } : {}),
  }

  return (
    <>
      <tr className="border-b border-rowan-border hover:bg-rowan-bg/50 transition-colors">
        <td className="text-left px-4 py-3 text-sm text-rowan-text">
          {formatDateTime(log.created_at || log.timestamp)}
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-text">
          {resolveAdminLabel(log)}
        </td>
        <td className="text-left px-4 py-3 text-sm">
          <Badge variant={actionConfig.color}>{actionConfig.label}</Badge>
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-text">
          {entityType || 'N/A'}
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-muted font-mono text-xs">
          {entityId ? `${entityId.substring(0, 8)}...` : 'N/A'}
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-text max-w-xs truncate">
          {resolveNotes(log)}
        </td>
        <td className="text-center px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-rowan-muted hover:text-rowan-text transition-colors"
          >
            <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-rowan-bg/30 border-b border-rowan-border">
          <td colSpan="7" className="px-4 py-4">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Details</p>
                <pre className="bg-rowan-surface rounded px-3 py-2 text-rowan-text overflow-x-auto text-xs max-h-48">
                  {JSON.stringify(detailPayload, null, 2)}
                </pre>
              </div>
              {(log.old_value || log.previous_state) && (log.new_value || log.new_state) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Previous State</p>
                    <pre className="bg-rowan-surface rounded px-3 py-2 text-rowan-text overflow-x-auto text-xs max-h-48">
                      {JSON.stringify(log.old_value || log.previous_state, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">New State</p>
                    <pre className="bg-rowan-surface rounded px-3 py-2 text-rowan-text overflow-x-auto text-xs max-h-48">
                      {JSON.stringify(log.new_value || log.new_state, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
