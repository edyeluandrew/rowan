import { useState, useCallback } from 'react'
import TopBar from '../../../shared/components/layout/TopBar'
import StatusDot from '../../../shared/components/ui/StatusDot'
import Button from '../../../shared/components/ui/Button'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import EmptyState from '../../../shared/components/ui/EmptyState'
import Badge from '../../../shared/components/ui/Badge'
import { Activity, CheckCircle } from 'lucide-react'
import useSystemHealth from '../hooks/useSystemHealth'
import { SYSTEM_SERVICES, ALERT_SEVERITIES } from '../../../shared/utils/constants'
import { formatDateTime } from '../../../shared/utils/format'
import { resolveAlert, logAdminAction } from '../../../shared/services/api/system'

export default function SystemHealthPage() {
  const { data, loading, error, refresh } = useSystemHealth()
  const [refreshing, setRefreshing] = useState(false)
  const [resolvingId, setResolvingId] = useState(null)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const handleResolve = async (alertId) => {
    setResolvingId(alertId)
    try {
      await resolveAlert(alertId)
      logAdminAction('resolve_alert', { alertId })
      await refresh()
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
            <EmptyState icon={CheckCircle} title="No active alerts" />
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-rowan-border/10 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge color={ALERT_SEVERITIES[alert.severity]?.color} bg={ALERT_SEVERITIES[alert.severity]?.bg}>
                        {ALERT_SEVERITIES[alert.severity]?.label}
                      </Badge>
                      <p className="text-rowan-text text-sm">{alert.message}</p>
                    </div>
                    <p className="text-rowan-muted text-xs mt-1">{formatDateTime(alert.created_at)}</p>
                  </div>
                  <Button
                    onClick={() => handleResolve(alert.id)}
                    loading={resolvingId === alert.id}
                    variant="ghost"
                    className="text-xs"
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resolved Alerts History */}
        {resolvedAlerts.length > 0 && (
          <details className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <summary className="text-rowan-text font-bold cursor-pointer">
              Resolved Alerts ({resolvedAlerts.length})
            </summary>
            <div className="mt-4 space-y-2">
              {resolvedAlerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className="p-2 bg-rowan-border/5 rounded text-xs text-rowan-muted">
                  {alert.message} — Resolved at {formatDateTime(alert.resolved_at)}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  )
}
