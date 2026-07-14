import { useState, useEffect, useCallback } from 'react'
import { Search, ShieldX, ShieldCheck, Plus, Trash2 } from 'lucide-react'
import TopBar from '../../../shared/components/layout/TopBar'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import {
  screenName,
  getScreeningChecks,
  getSanctionsList,
  addSanctionsEntity,
  removeSanctionsEntity,
} from '../../../shared/services/api/system'
import { formatDateTime } from '../../../shared/utils/format'

function ResultBadge({ result }) {
  const hit = result === 'HIT'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
        hit
          ? 'bg-rowan-red/10 text-rowan-red border-rowan-red/30'
          : 'bg-rowan-green/10 text-rowan-green border-rowan-green/30'
      }`}
    >
      {hit ? <ShieldX size={12} /> : <ShieldCheck size={12} />} {result}
    </span>
  )
}

export default function ScreeningPage() {
  // Manual check
  const [name, setName] = useState('')
  const [dob, setDob] = useState('')
  const [country, setCountry] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)

  // Recent checks
  const [checks, setChecks] = useState(null)
  const [checksLoading, setChecksLoading] = useState(true)

  // Internal blocklist
  const [entities, setEntities] = useState(null)
  const [bySource, setBySource] = useState({})
  const [listLoading, setListLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const [error, setError] = useState(null)

  const loadChecks = useCallback(async () => {
    setChecksLoading(true)
    try {
      const res = await getScreeningChecks({ limit: 25 })
      setChecks(res)
    } catch {
      setError('Failed to load screening history.')
    } finally {
      setChecksLoading(false)
    }
  }, [])

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await getSanctionsList()
      setEntities(res.entities || [])
      setBySource(res.by_source || {})
    } catch {
      setError('Failed to load blocklist.')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { loadChecks(); loadList() }, [loadChecks, loadList])

  const handleCheck = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setChecking(true)
    setCheckResult(null)
    setError(null)
    try {
      const res = await screenName({ name: name.trim(), dob: dob || undefined, country: country || undefined })
      setCheckResult(res)
      loadChecks()
    } catch {
      setError('Screening request failed.')
    } finally {
      setChecking(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    try {
      await addSanctionsEntity({ full_name: newName.trim() })
      setNewName('')
      loadList()
    } catch {
      setError('Failed to add entry.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    if (!window.confirm('Remove this entry from the internal blocklist?')) return
    try {
      await removeSanctionsEntity(id)
      loadList()
    } catch {
      setError('Failed to remove entry.')
    }
  }

  return (
    <>
      <TopBar title="Sanctions Screening" onRefresh={() => { loadChecks(); loadList() }} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* List coverage */}
        <div className="flex gap-3 flex-wrap">
          {Object.entries(bySource).length === 0 ? (
            <div className="bg-rowan-orange/10 border border-rowan-orange/30 text-rowan-orange rounded-xl px-4 py-3 text-sm">
              No sanctions lists loaded yet. Add internal entries below, or run <code>npm run script:load-ofac</code> to import the OFAC SDN list.
            </div>
          ) : (
            Object.entries(bySource).map(([src, cnt]) => (
              <div key={src} className="bg-rowan-surface rounded-xl border border-rowan-border px-4 py-2">
                <span className="text-rowan-muted text-xs uppercase tracking-wide">{src}</span>
                <span className="text-rowan-text font-bold ml-2 tabular-nums">{cnt}</span>
              </div>
            ))
          )}
        </div>

        {/* Manual check */}
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <h3 className="text-rowan-text font-bold mb-3">Screen a name</h3>
          <form onSubmit={handleCheck} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="md:col-span-2 bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-sm text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow"
            />
            <input
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="DOB (optional)"
              className="bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-sm text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow"
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country (optional)"
              className="bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-sm text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow"
            />
            <button
              type="submit"
              disabled={checking || !name.trim()}
              className="md:col-span-4 md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/40 hover:bg-rowan-yellow/20 disabled:opacity-50 transition-colors"
            >
              {checking ? <LoadingSpinner size={14} /> : <Search size={14} />} Screen
            </button>
          </form>

          {checkResult && (
            <div
              className={`mt-4 rounded-lg border p-3 ${
                checkResult.match
                  ? 'bg-rowan-red/10 border-rowan-red/30'
                  : 'bg-rowan-green/10 border-rowan-green/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <ResultBadge result={checkResult.result} />
                <span className="text-rowan-text text-sm">
                  score {checkResult.score} (threshold {checkResult.threshold})
                </span>
              </div>
              {checkResult.match && (
                <p className="text-rowan-text text-sm mt-2">
                  Closest match: <span className="font-semibold">{checkResult.matchedName}</span> [{checkResult.matchedSource}]
                </p>
              )}
            </div>
          )}
        </div>

        {/* Internal blocklist */}
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <h3 className="text-rowan-text font-bold mb-3">Internal blocklist</h3>
          <form onSubmit={handleAdd} className="flex gap-2 mb-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add a name to block"
              className="flex-1 bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-sm text-rowan-text placeholder-rowan-muted focus:outline-none focus:border-rowan-yellow"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/40 hover:bg-rowan-yellow/20 disabled:opacity-50 transition-colors"
            >
              <Plus size={14} /> Add
            </button>
          </form>

          {listLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={20} /></div>
          ) : entities && entities.length > 0 ? (
            <div className="divide-y divide-rowan-border/50">
              {entities.map((en) => (
                <div key={en.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0">
                    <p className="text-rowan-text text-sm font-medium">{en.full_name}</p>
                    <p className="text-rowan-muted text-xs">
                      {en.entity_type}
                      {en.aliases?.length ? ` · aka ${en.aliases.join(', ')}` : ''}
                      {en.remarks ? ` · ${en.remarks}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemove(en.id)}
                    className="shrink-0 p-2 rounded-lg text-rowan-muted hover:text-rowan-red hover:bg-rowan-red/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-rowan-muted text-sm">No internal blocklist entries.</p>
          )}
        </div>

        {/* Recent checks */}
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-rowan-text font-bold">Recent screening activity</h3>
            {checks?.summary && (
              <span className="text-rowan-muted text-xs">
                {checks.summary.hits} hit(s) / {checks.summary.total} total
              </span>
            )}
          </div>
          {checksLoading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={20} /></div>
          ) : checks?.checks?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-rowan-muted text-left">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Subject</th>
                    <th className="py-2 font-medium">Result</th>
                    <th className="py-2 font-medium text-right">Score</th>
                    <th className="py-2 font-medium">Matched</th>
                    <th className="py-2 font-medium text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.checks.map((c) => (
                    <tr key={c.id} className="border-t border-rowan-border/50">
                      <td className="py-2 text-rowan-text">{c.query_name}</td>
                      <td className="py-2 text-rowan-muted">{c.subject_type}</td>
                      <td className="py-2"><ResultBadge result={c.result} /></td>
                      <td className="py-2 text-right text-rowan-muted tabular-nums">{c.top_score}</td>
                      <td className="py-2 text-rowan-muted">{c.matched_name || '—'}</td>
                      <td className="py-2 text-right text-rowan-muted">{formatDateTime(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-rowan-muted text-sm">No screening activity yet.</p>
          )}
        </div>
      </div>
    </>
  )
}
