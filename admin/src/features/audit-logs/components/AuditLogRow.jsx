import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Badge from '../../../shared/components/ui/Badge'
import { ACTION_TYPES } from '../utils/constants'

function formatDateTime(date) {
  if (!date) return 'N/A'
  const d = new Date(date)
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

export default function AuditLogRow({ log }) {
  const [expanded, setExpanded] = useState(false)

  const actionConfig = ACTION_TYPES[log.action] || {
    label: log.action,
    color: 'gray',
  }

  return (
    <>
      <tr className="border-b border-rowan-border hover:bg-rowan-bg/50 transition-colors">
        <td className="text-left px-4 py-3 text-sm text-rowan-text">
          {formatDateTime(log.created_at || log.timestamp)}
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-text">
          {log.admin_email || log.adminId || 'Unknown'}
        </td>
        <td className="text-left px-4 py-3 text-sm">
          <Badge variant={actionConfig.color}>{actionConfig.label}</Badge>
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-text">
          {log.entity_type || log.targetType || 'N/A'}
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-muted font-mono text-xs">
          {log.entity_id || log.targetId ? (
            `${(log.entity_id || log.targetId).substring(0, 8)}...`
          ) : (
            'N/A'
          )}
        </td>
        <td className="text-left px-4 py-3 text-sm text-rowan-text max-w-xs truncate">
          {log.details?.reason || log.metadata?.reason || log.details?.message || '-'}
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
                  {JSON.stringify(log.details || log.metadata || {}, null, 2)}
                </pre>
              </div>
              {log.previous_state && log.new_state && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Previous State</p>
                    <pre className="bg-rowan-surface rounded px-3 py-2 text-rowan-text overflow-x-auto text-xs max-h-48">
                      {JSON.stringify(log.previous_state, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">New State</p>
                    <pre className="bg-rowan-surface rounded px-3 py-2 text-rowan-text overflow-x-auto text-xs max-h-48">
                      {JSON.stringify(log.new_state, null, 2)}
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
