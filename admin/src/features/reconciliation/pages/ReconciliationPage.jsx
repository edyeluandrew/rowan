import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import TopBar from '../../../shared/components/layout/TopBar'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import { getReconciliation } from '../../../shared/services/api/system'
import { formatUsdc, formatDateTime } from '../../../shared/utils/format'

const STATUS_STYLES = {
  OK: { cls: 'bg-rowan-green/10 border-rowan-green/30 text-rowan-green', Icon: ShieldCheck, label: 'Balanced' },
  WARNING: { cls: 'bg-rowan-orange/10 border-rowan-orange/30 text-rowan-orange', Icon: ShieldAlert, label: 'Warning' },
  CRITICAL: { cls: 'bg-rowan-red/10 border-rowan-red/30 text-rowan-red', Icon: ShieldX, label: 'Critical' },
}

export default function ReconciliationPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await getReconciliation()
      setData(res)
    } catch {
      setError('Failed to load reconciliation report.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const status = data?.status || 'OK'
  const style = STATUS_STYLES[status] || STATUS_STYLES.OK
  const StatusIcon = style.Icon
  const byState = data?.by_state || {}
  const float = data?.partner_float

  return (
    <>
      <TopBar title="Reconciliation" onRefresh={() => load(true)} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : data ? (
          <>
            {/* Status banner */}
            <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${style.cls}`}>
              <StatusIcon size={20} />
              <span className="font-bold">{style.label}</span>
              <span className="text-sm opacity-80">
                {status === 'CRITICAL'
                  ? '— escrow shortfall detected, investigate immediately'
                  : status === 'WARNING'
                    ? '— review surplus / anomalies below'
                    : '— on-chain USDC matches ledger liability'}
              </span>
            </div>

            {/* Key numbers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <p className="text-rowan-muted text-xs uppercase tracking-wide">On-chain escrow USDC</p>
                <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">
                  {data.on_chain_usdc == null ? '—' : formatUsdc(data.on_chain_usdc)}
                </p>
              </div>
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <p className="text-rowan-muted text-xs uppercase tracking-wide">DB liability (in-flight)</p>
                <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">
                  {data.db_liability_usdc == null ? '—' : formatUsdc(data.db_liability_usdc)}
                </p>
                <p className="text-rowan-muted text-xs mt-1">{data.in_flight_count} transaction(s)</p>
              </div>
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <p className="text-rowan-muted text-xs uppercase tracking-wide">Drift (on-chain − liability)</p>
                <p className={`text-2xl font-bold tabular-nums mt-1 ${
                  data.drift_usdc == null ? 'text-rowan-text'
                    : data.drift_usdc < -data.drift_tolerance ? 'text-rowan-red'
                    : data.drift_usdc > data.drift_tolerance ? 'text-rowan-orange'
                    : 'text-rowan-green'
                }`}>
                  {data.drift_usdc == null ? '—' : `${data.drift_usdc >= 0 ? '+' : ''}${formatUsdc(data.drift_usdc)}`}
                </p>
                <p className="text-rowan-muted text-xs mt-1">tolerance ±{data.drift_tolerance} USDC</p>
              </div>
            </div>

            {/* Criticals / warnings */}
            {(data.criticals?.length > 0 || data.warnings?.length > 0) && (
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4 space-y-2">
                {data.criticals?.map((c, i) => (
                  <p key={`c${i}`} className="text-rowan-red text-sm flex items-start gap-2">
                    <ShieldX size={16} className="shrink-0 mt-0.5" /> {c}
                  </p>
                ))}
                {data.warnings?.map((w, i) => (
                  <p key={`w${i}`} className="text-rowan-orange text-sm flex items-start gap-2">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" /> {w}
                  </p>
                ))}
              </div>
            )}

            {/* Liability by state */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <h3 className="text-rowan-text font-bold mb-3">Liability by state</h3>
              {Object.keys(byState).length === 0 ? (
                <p className="text-rowan-muted text-sm">No in-flight escrow.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-rowan-muted text-left">
                      <th className="py-2 font-medium">State</th>
                      <th className="py-2 font-medium text-right">Count</th>
                      <th className="py-2 font-medium text-right">USDC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byState).map(([state, v]) => (
                      <tr key={state} className="border-t border-rowan-border/50">
                        <td className="py-2 text-rowan-text">{state}</td>
                        <td className="py-2 text-right text-rowan-muted tabular-nums">{v.count}</td>
                        <td className="py-2 text-right text-rowan-text tabular-nums">{formatUsdc(v.usdc)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {data.missing_usdc_count > 0 && (
                <p className="text-rowan-orange text-xs mt-3">
                  {data.missing_usdc_count} in-flight transaction(s) missing a USDC amount — liability may be understated.
                </p>
              )}
            </div>

            {/* Partner float snapshot */}
            {float && (
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-3">Partner float snapshot</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-rowan-muted text-xs">Available float</p>
                    <p className="text-rowan-text font-semibold tabular-nums">{formatUsdc(float.available_float)}</p>
                  </div>
                  <div>
                    <p className="text-rowan-muted text-xs">Reserved float</p>
                    <p className="text-rowan-text font-semibold tabular-nums">{formatUsdc(float.reserved_float)}</p>
                  </div>
                  <div>
                    <p className="text-rowan-muted text-xs">Available USDC</p>
                    <p className="text-rowan-text font-semibold tabular-nums">{formatUsdc(float.available_usdc)}</p>
                  </div>
                  <div>
                    <p className="text-rowan-muted text-xs">Reserved USDC</p>
                    <p className="text-rowan-text font-semibold tabular-nums">{formatUsdc(float.reserved_usdc)}</p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-rowan-muted text-xs">
              Network: {data.network} · Escrow: {data.escrow_public_key || '—'} · Checked {formatDateTime(data.checked_at)}
            </p>
          </>
        ) : null}
      </div>
    </>
  )
}
