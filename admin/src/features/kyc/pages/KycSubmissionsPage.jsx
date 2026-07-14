import { useState, useEffect, useCallback } from 'react'
import { BadgeCheck, UserCheck, X, Check, FileText } from 'lucide-react'
import TopBar from '../../../shared/components/layout/TopBar'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import {
  getKycSubmissions,
  approveKycSubmission,
  rejectKycSubmission,
} from '../../../shared/services/api/system'
import { formatDateTime } from '../../../shared/utils/format'

const STATUS_STYLES = {
  PENDING: 'bg-rowan-orange/10 text-rowan-orange border-rowan-orange/30',
  APPROVED: 'bg-rowan-green/10 text-rowan-green border-rowan-green/30',
  REJECTED: 'bg-rowan-red/10 text-rowan-red border-rowan-red/30',
}

const FILTERS = [
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'ALL', label: 'All' },
]

function DocLink({ label, url }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-rowan-yellow hover:underline text-xs"
    >
      <FileText size={12} /> {label}
    </a>
  )
}

export default function KycSubmissionsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('PENDING')
  const [busy, setBusy] = useState(null)

  const load = useCallback(async (filterId, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const params = filterId === 'ALL' ? {} : { status: filterId }
      const res = await getKycSubmissions(params)
      setData(res)
    } catch {
      setError('Failed to load KYC submissions.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(filter) }, [load, filter])

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this submission and raise the user\u2019s KYC level?')) return
    setBusy(id)
    try {
      await approveKycSubmission(id)
      await load(filter, true)
    } catch {
      setError('Failed to approve submission.')
    } finally {
      setBusy(null)
    }
  }

  const handleReject = async (id) => {
    const reason = window.prompt('Reason for rejection (shown to the user):')
    if (reason == null || !reason.trim()) return
    setBusy(id)
    try {
      await rejectKycSubmission(id, reason.trim())
      await load(filter, true)
    } catch {
      setError('Failed to reject submission.')
    } finally {
      setBusy(null)
    }
  }

  const submissions = data?.submissions || []
  const summary = data?.summary || { total: 0, pending: 0, approved: 0, rejected: 0 }

  return (
    <>
      <TopBar title="KYC Submissions" onRefresh={() => load(filter, true)} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Summary chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Total</p>
            <p className="text-rowan-text text-2xl font-bold tabular-nums mt-1">{summary.total}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Pending</p>
            <p className="text-rowan-orange text-2xl font-bold tabular-nums mt-1">{summary.pending}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Approved</p>
            <p className="text-rowan-green text-2xl font-bold tabular-nums mt-1">{summary.approved}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
            <p className="text-rowan-muted text-xs uppercase tracking-wide">Rejected</p>
            <p className="text-rowan-red text-2xl font-bold tabular-nums mt-1">{summary.rejected}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
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

        {/* Submissions */}
        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-rowan-muted">
            <UserCheck size={40} className="mb-3 text-rowan-green" />
            <p className="text-sm">No KYC submissions match this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <div key={s.id} className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BadgeCheck size={18} className="text-rowan-yellow shrink-0" />
                      <span className="text-rowan-text font-semibold">{s.full_name}</span>
                      <span className="text-rowan-muted text-xs">
                        {s.user_current_level} &rarr; <span className="text-rowan-text font-medium">{s.requested_level}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[s.status]}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-rowan-muted text-sm mt-2">
                      {s.document_type} &middot; {s.document_number}
                      {s.document_country ? ` \u00b7 ${s.document_country}` : ''}
                      {s.date_of_birth ? ` \u00b7 DOB ${String(s.date_of_birth).slice(0, 10)}` : ''}
                    </p>
                    {s.user_email && <p className="text-rowan-muted text-xs mt-1">{s.user_email}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <DocLink label="ID front" url={s.document_front_url} />
                      <DocLink label="ID back" url={s.document_back_url} />
                      <DocLink label="Selfie" url={s.selfie_url} />
                    </div>
                    <p className="text-rowan-muted text-xs mt-2">Submitted {formatDateTime(s.created_at)}</p>
                    {s.status === 'REJECTED' && s.review_notes && (
                      <p className="text-rowan-red text-xs mt-1">Rejected: {s.review_notes}</p>
                    )}
                  </div>

                  {s.status === 'PENDING' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleReject(s.id)}
                        disabled={busy === s.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-rowan-red border border-rowan-red/40 hover:bg-rowan-red/10 disabled:opacity-50 transition-colors"
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(s.id)}
                        disabled={busy === s.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-rowan-green/10 text-rowan-green border border-rowan-green/40 hover:bg-rowan-green/20 disabled:opacity-50 transition-colors"
                      >
                        {busy === s.id ? <LoadingSpinner size={14} /> : <Check size={14} />} Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
