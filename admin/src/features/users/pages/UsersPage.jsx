import { useState, useEffect, useCallback } from 'react'
import { Search, Snowflake, Sun, ShieldAlert, ScanSearch, X } from 'lucide-react'
import TopBar from '../../../shared/components/layout/TopBar'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import { getUsers, getUser, freezeUser, unfreezeUser } from '../../../shared/services/api/users'
import { formatDateTime } from '../../../shared/utils/format'

const FILTERS = [
  { id: 'all', label: 'All', params: {} },
  { id: 'active', label: 'Active', params: { status: 'active' } },
  { id: 'frozen', label: 'Frozen', params: { status: 'frozen' } },
]

function short(id) {
  return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : '—'
}

function KycBadge({ level }) {
  const cls =
    level === 'VERIFIED' ? 'bg-rowan-green/10 text-rowan-green border-rowan-green/30'
    : level === 'BASIC' ? 'bg-rowan-yellow/10 text-rowan-yellow border-rowan-yellow/30'
    : 'bg-rowan-muted/10 text-rowan-muted border-rowan-border'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{level}</span>
}

function UserDrawer({ id, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getUser(id)
      setData(res)
    } catch {
      setError('Failed to load user.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const doFreeze = async () => {
    const reason = window.prompt('Reason for freezing this user (audit-logged):')
    if (reason == null || !reason.trim()) return
    setBusy(true)
    try {
      await freezeUser(id, reason.trim())
      await load(); onChanged?.()
    } catch { setError('Freeze failed.') } finally { setBusy(false) }
  }

  const doUnfreeze = async () => {
    if (!window.confirm('Reactivate this user?')) return
    setBusy(true)
    try {
      await unfreezeUser(id)
      await load(); onChanged?.()
    } catch { setError('Unfreeze failed.') } finally { setBusy(false) }
  }

  const u = data?.user

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-rowan-bg border-l border-rowan-border h-full overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-rowan-text font-bold">User detail</h2>
          <button onClick={onClose} className="text-rowan-muted hover:text-rowan-text"><X size={20} /></button>
        </div>

        {error && <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : u ? (
          <div className="space-y-4">
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <div className="flex items-center justify-between">
                <KycBadge level={u.kyc_level} />
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? 'bg-rowan-green/10 text-rowan-green border-rowan-green/30' : 'bg-rowan-red/10 text-rowan-red border-rowan-red/30'}`}>
                  {u.is_active ? 'Active' : 'Frozen'}
                </span>
              </div>
              <p className="text-rowan-text text-sm font-mono mt-3 break-all">{u.stellar_address}</p>
              {u.email && <p className="text-rowan-muted text-xs mt-1">{u.email}</p>}
              <p className="text-rowan-muted text-xs mt-2">
                Daily limit {Number(u.daily_limit_ugx).toLocaleString()} UGX · {data.transaction_count} tx · joined {formatDateTime(u.created_at)}
              </p>
            </div>

            <div className="flex gap-2">
              {u.is_active ? (
                <button onClick={doFreeze} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-rowan-red/10 text-rowan-red border border-rowan-red/40 hover:bg-rowan-red/20 disabled:opacity-50">
                  {busy ? <LoadingSpinner size={14} /> : <Snowflake size={14} />} Freeze user
                </button>
              ) : (
                <button onClick={doUnfreeze} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-rowan-green/10 text-rowan-green border border-rowan-green/40 hover:bg-rowan-green/20 disabled:opacity-50">
                  {busy ? <LoadingSpinner size={14} /> : <Sun size={14} />} Reactivate
                </button>
              )}
            </div>

            {/* Risk signals */}
            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={14} className="text-rowan-orange" />
                <h3 className="text-rowan-text text-sm font-semibold">Recent fraud alerts</h3>
              </div>
              {data.recent_fraud_alerts.length === 0 ? (
                <p className="text-rowan-muted text-xs">None</p>
              ) : data.recent_fraud_alerts.map((a) => (
                <div key={a.id} className="text-xs py-1 border-t border-rowan-border/50 first:border-0">
                  <span className={a.severity === 'HIGH' ? 'text-rowan-red' : 'text-rowan-orange'}>{a.alert_type}</span>
                  <span className="text-rowan-muted"> · {formatDateTime(a.created_at)}</span>
                  {a.details && <p className="text-rowan-muted">{a.details}</p>}
                </div>
              ))}
            </div>

            <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <ScanSearch size={14} className="text-rowan-muted" />
                <h3 className="text-rowan-text text-sm font-semibold">Recent screening</h3>
              </div>
              {data.recent_screening_checks.length === 0 ? (
                <p className="text-rowan-muted text-xs">None</p>
              ) : data.recent_screening_checks.map((s) => (
                <div key={s.id} className="text-xs py-1 border-t border-rowan-border/50 first:border-0 flex justify-between">
                  <span className={s.result === 'HIT' ? 'text-rowan-red' : 'text-rowan-green'}>{s.result} ({s.top_score})</span>
                  <span className="text-rowan-muted">{s.subject_type} · {formatDateTime(s.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async (filterId, q, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true)
    setError(null)
    try {
      const params = { ...(FILTERS.find((f) => f.id === filterId)?.params || {}) }
      if (q?.trim()) params.q = q.trim()
      const res = await getUsers(params)
      setData(res)
    } catch {
      setError('Failed to load users.')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(filter, search) }, [load, filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => { e.preventDefault(); load(filter, search, true) }

  const users = data?.users || []
  const summary = data?.summary || { total: 0, frozen: 0 }

  return (
    <>
      <TopBar title="Users" onRefresh={() => load(filter, search, true)} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Total users</p>
            <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">{summary.total}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Frozen</p>
            <p className="text-rowan-red text-2xl font-bold tabular-nums mt-1">{summary.frozen}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.id ? 'bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/40' : 'text-rowan-muted border border-rowan-border hover:text-rowan-text'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <form onSubmit={onSearch} className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id / address / email"
              className="bg-rowan-surface border border-rowan-border rounded-lg px-3 py-1.5 text-sm text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow w-64" />
            <button type="submit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-rowan-muted border border-rowan-border hover:text-rowan-text">
              <Search size={14} /> Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : users.length === 0 ? (
          <p className="text-rowan-muted text-sm py-8 text-center">No users match this filter.</p>
        ) : (
          <div className="bg-rowan-surface rounded-xl border border-rowan-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-rowan-muted text-left">
                  <th className="py-2 px-4 font-medium">Address</th>
                  <th className="py-2 px-4 font-medium">KYC</th>
                  <th className="py-2 px-4 font-medium">Status</th>
                  <th className="py-2 px-4 font-medium text-right">Daily limit</th>
                  <th className="py-2 px-4 font-medium text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => setSelectedId(u.id)}
                    className="border-t border-rowan-border/50 cursor-pointer hover:bg-rowan-bg/50">
                    <td className="py-2 px-4 text-rowan-text font-mono">{short(u.stellar_address)}</td>
                    <td className="py-2 px-4"><KycBadge level={u.kyc_level} /></td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${u.is_active ? 'bg-rowan-green/10 text-rowan-green border-rowan-green/30' : 'bg-rowan-red/10 text-rowan-red border-rowan-red/30'}`}>
                        {u.is_active ? 'Active' : 'Frozen'}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-rowan-muted tabular-nums">{Number(u.daily_limit_ugx).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-rowan-muted">{formatDateTime(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <UserDrawer id={selectedId} onClose={() => setSelectedId(null)} onChanged={() => load(filter, search, true)} />
      )}
    </>
  )
}
