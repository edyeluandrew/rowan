import { useState, useCallback } from 'react'
import TopBar from '../../../shared/components/layout/TopBar'
import AuditLogFilters from '../components/AuditLogFilters'
import AuditLogRow from '../components/AuditLogRow'
import Pagination from '../../../shared/components/ui/Pagination'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import EmptyState from '../../../shared/components/ui/EmptyState'
import { FileText } from 'lucide-react'
import useAuditLogs from '../hooks/useAuditLogs'

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({})
  const { logs, loading, error, pages, page, setPage, refresh } = useAuditLogs(filters)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const totalPages = pages || 1

  return (
    <>
      <TopBar title="Audit Logs" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <p className="text-rowan-text text-sm">
            View all admin actions and operational events. Expand rows for detailed metadata.
          </p>
        </div>

        <AuditLogFilters filters={filters} onChange={setFilters} />

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load audit logs: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size={24} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No audit logs found"
            description="Adjust filters or check back later"
          />
        ) : (
          <>
            <div className="bg-rowan-surface rounded-xl border border-rowan-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Timestamp</th>
                    <th className="text-left px-4 py-3 font-medium">Admin</th>
                    <th className="text-left px-4 py-3 font-medium">Action</th>
                    <th className="text-left px-4 py-3 font-medium">Entity</th>
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Reason / Notes</th>
                    <th className="text-center px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <AuditLogRow key={log.id || `${log.timestamp}-${log.admin_email}`} log={log} />
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
          </>
        )}
      </div>
    </>
  )
}
