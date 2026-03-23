import { useState, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import StatusDot from '../components/ui/StatusDot'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Activity, CheckCircle } from 'lucide-react'
import useSystemHealth from '../hooks/useSystemHealth'
import { SYSTEM_SERVICES, ALERT_SEVERITIES } from '../utils/constants'
import { formatDateTime } from '../utils/format'
import { resolveAlert, logAdminAction } from '../api/system'
import Badge from '../components/ui/Badge'

export default function SystemHealth() {
  const { data, loading, error, refetch } = useSystemHealth()
  const [refreshing, setRefreshing] = useState(false)
  const [resolvingId, setResolvingId] = useState(null)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleResolve = async (alertId) => {
    setResolvingId(alertId)
    try {
      await resolveAlert(alertId)
      logAdminAction('resolve_alert', { alertId })
      await refetch()
    } catch {
      /* handled by interceptor */
    } finally {
      setResolvingId(null)
    }
  }

  const health = data?.health || {}
  const alerts = data?.alerts || []
  const services = health.services || {}

  const overallStatus = health.status || 'healthy'
  const statusColors = {
    healthy: 'bg-rowan-green/10 border-rowan-green/30 text-rowan-green',
    degraded: 'bg-rowan-orange/10 border-rowan-orange/30 text-rowan-orange',
    down: 'bg-rowan-red/10 border-rowan-red/30 text-rowan-red',
  }

  const activeAlerts = alerts.filter((a) => !a.resolved)
  const resolvedAlerts = alerts.filter((a) => a.resolved)

  return (
    <>
      <TopBar title="System Health" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load system health data.
          </div>
        )}

        {/* Overall Status Banner */}
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${statusColors[overallStatus] || statusColors.healthy}`}>
          <StatusDot status={overallStatus} />
          <span className="font-bold capitalize">{overallStatus}</span>
          <span className="text-sm opacity-80">- All systems {overallStatus === 'healthy' ? 'operational' : overallStatus === 'degraded' ? 'partially degraded' : 'experiencing issues'}</span>
        </div>

        {/* Service Health Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-rowan-surface rounded-xl border border-rowan-border p-4 h-20 animate-pulse" />
            ))
          ) : (
            SYSTEM_SERVICES.map((svc) => {
              const svcData = services[svc.key] || {}
              const status = svcData.status || 'healthy'
              return (
                <div key={svc.key} className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-rowan-text text-sm font-medium">{svc.label}</span>
                    <StatusDot status={status} />
                  </div>
                  <p className="text-rowan-muted text-xs capitalize">{status}</p>
                  {svcData.latency && (
                    <p className="text-rowan-muted text-xs mt-1">{svcData.latency}ms</p>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Active Alerts */}
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <h3 className="text-rowan-text font-bold mb-4">Active Alerts ({activeAlerts.length})</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={24} /></div>
          ) : activeAlerts.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No active alerts" description="All systems running normally" />
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => {
                const sev = ALERT_SEVERITIES[alert.severity] || ALERT_SEVERITIES.info
                return (
                  <div key={alert.id} className="flex items-center gap-3 bg-rowan-bg rounded-xl px-4 py-3">
                    <Badge color={sev.color} bg={sev.bg}>{sev.label}</Badge>
                    <span className="flex-1 text-rowan-text text-sm">{alert.message}</span>
                    <span className="text-rowan-muted text-xs shrink-0">{formatDateTime(alert.created_at)}</span>
                    <Button
                      variant="ghost"
                      onClick={() => handleResolve(alert.id)}
                      loading={resolvingId === alert.id}
                    >
                      Resolve
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Alert History */}
        {resolvedAlerts.length > 0 && (
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <h3 className="text-rowan-text font-bold mb-4">Alert History</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">Severity</th>
                    <th className="text-left px-4 py-2 font-medium">Message</th>
                    <th className="text-left px-4 py-2 font-medium">Created</th>
                    <th className="text-left px-4 py-2 font-medium">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedAlerts.map((alert) => {
                    const sev = ALERT_SEVERITIES[alert.severity] || ALERT_SEVERITIES.info
                    return (
                      <tr key={alert.id} className="border-b border-rowan-border/50">
                        <td className="px-4 py-2"><Badge color={sev.color} bg={sev.bg}>{sev.label}</Badge></td>
                        <td className="px-4 py-2 text-sm text-rowan-text">{alert.message}</td>
                        <td className="px-4 py-2 text-sm text-rowan-muted">{formatDateTime(alert.created_at)}</td>
                        <td className="px-4 py-2 text-sm text-rowan-muted">{formatDateTime(alert.resolved_at)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
