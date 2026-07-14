import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, ShieldCheck, Check } from 'lucide-react'
import TopBar from '../../../shared/components/layout/TopBar'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import { getFraudAlerts, acknowledgeFraudAlert } from '../../../shared/services/api/system'
import { formatDateTime } from '../../../shared/utils/format'

const SEVERITY_STYLES = {
  HIGH: 'bg-rowan-red/10 text-rowan-red border-rowan-red/30',
  MEDIUM: 'bg-rowan-orange/10 text-rowan-orange border-rowan-orange/30',
  LOW: 'bg-rowan-muted/10 text-rowan-muted border-rowan-border',
}

const FILTERS = [
  { id: 'unack', label: 'Unacknowledged', params: { acknowledged: 'false' } },
  { id: 'high', label: 'High severity', params: { acknowledged: 'false', severity: 'HIGH' } },
  { id: 'all', label: 'All', params: {} },
]

export default function FraudAlertsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('unack')
  const [acking, setAcking] = useState(null)

  const load = useCallback(async (filterId, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const params = FILTERS.find((f) => f.id === filterId)?.params || {}
      const res = await getFraudAlerts(params)
      setData(res)
    } catch {
      setError('Failed to load fraud alerts.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(filter) }, [load, filter])

  const handleAck = async (id) => {
    setAcking(id)
    try {
      await acknowledgeFraudAlert(id)
      await load(filter, true)
    } catch {
      setError('Failed to acknowledge alert.')
    } finally {
      setAcking(null)
    }
  }

  const alerts = data?.alerts || []
  const summary = data?.summary || { total: 0, unacknowledged: 0, unack_high: 0 }

  return (
    <>
      <TopBar title="Fraud Alerts" onRefresh={() => load(filter, true)} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Summary chips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Total alerts</p>
            <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">{summary.total}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Unacknowledged</p>
            <p className="text-rowan-orange text-2xl font-bold tabular-nums mt-1">{summary.unacknowledged}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Unack · high severity</p>
            <p className="text-rowan-red text-2xl font-bold tabular-nums mt-1">{summary.unack_high}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.id
                  ? 'bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/40'
                  : 'text-rowan-muted border border-rowan-border hover:text-rowan-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Alerts list */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-rowan-muted">
            <ShieldCheck size={40} className="mb-3 text-rowan-green" />
            <p className="text-sm">No fraud alerts match this filter.</p>
          </div>
        ) : (
          <div className="bg-rowan-surface rounded-xl border border-rowan-border divide-y divide-rowan-border/50">
            {alerts.map((a) => (
              <div key={a.id} className="p-4 flex items-start gap-4">
                <ShieldAlert
                  size={20}
                  className={`shrink-0 mt-0.5 ${a.severity === 'HIGH' ? 'text-rowan-red' : a.severity === 'MEDIUM' ? 'text-rowan-orange' : 'text-rowan-muted'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-rowan-text font-semibold text-sm">{a.alert_type}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.LOW}`}>
                      {a.severity}
                    </span>
                    {a.acknowledged && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rowan-green/10 text-rowan-green border border-rowan-green/30">
                        acknowledged
                      </span>
                    )}
                  </div>
                  {a.details && <p className="text-rowan-muted text-sm mt-1 break-words">{a.details}</p>}
                  <p className="text-rowan-muted text-xs mt-1">
                    {a.trader_name && <>Trader: {a.trader_name} · </>}
                    {a.user_email && <>User: {a.user_email} · </>}
                    {a.user_kyc && <>KYC: {a.user_kyc} · </>}
                    {formatDateTime(a.created_at)}
                  </p>
                </div>
                {!a.acknowledged && (
                  <button
                    onClick={() => handleAck(a.id)}
                    disabled={acking === a.id}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/40 hover:bg-rowan-yellow/20 disabled:opacity-50 transition-colors"
                  >
                    {acking === a.id ? <LoadingSpinner size={14} /> : <Check size={14} />}
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
