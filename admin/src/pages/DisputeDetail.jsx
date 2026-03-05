import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import TopBar from '../components/layout/TopBar'
import TransactionStateTag from '../components/transactions/TransactionStateTag'
import DisputePriorityBadge from '../components/disputes/DisputePriorityBadge'
import ResolutionModal from '../components/disputes/ResolutionModal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import CopyButton from '../components/ui/CopyButton'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { getDispute, resolveDispute, escalateDispute, addDisputeNote } from '../api/disputes'
import { logAdminAction } from '../api/system'
import { formatXlm, formatDateTime, formatAddress } from '../utils/format'

export default function DisputeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dispute, setDispute] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolveModal, setResolveModal] = useState(false)
  const [escalateConfirm, setEscalateConfirm] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [note, setNote] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)

  const fetchDispute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getDispute(id)
      setDispute(data)
    } catch (err) {
      setError(err?.message || 'Failed to load dispute')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchDispute() }, [fetchDispute])

  const handleResolve = async ({ outcome, notes }) => {
    setActionLoading(true)
    try {
      await resolveDispute(id, { outcome, notes })
      logAdminAction('resolve_dispute', { disputeId: id, outcome, notes })
      setResolveModal(false)
      await fetchDispute()
    } catch {
      /* handled by interceptor */
    } finally {
      setActionLoading(false)
    }
  }

  const handleEscalate = async () => {
    setActionLoading(true)
    try {
      await escalateDispute(id)
      logAdminAction('escalate_dispute', { disputeId: id })
      setEscalateConfirm(false)
      await fetchDispute()
    } catch {
      /* handled by interceptor */
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!note.trim()) return
    setNoteLoading(true)
    try {
      await addDisputeNote(id, note.trim())
      setNote('')
      await fetchDispute()
    } catch {
      /* handled by interceptor */
    } finally {
      setNoteLoading(false)
    }
  }

  return (
    <>
      <TopBar title="Dispute Detail" onRefresh={fetchDispute} refreshing={loading} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <button onClick={() => navigate('/disputes')} className="flex items-center gap-2 text-rowan-muted hover:text-rowan-text text-sm">
          <ArrowLeft size={16} />
          <span>Back to Disputes</span>
        </button>

        {loading && !dispute ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : error ? (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">{error}</div>
        ) : dispute ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Transaction Summary */}
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-4">Transaction Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Transaction ID" value={formatAddress(dispute.transaction_id || '')} copy={dispute.transaction_id} />
                  <Field label="Amount" value={formatXlm(dispute.amount)} />
                  <Field label="Network" value={dispute.network || '-'} />
                  <Field label="State" value={<TransactionStateTag state={dispute.transaction_state || 'disputed'} />} />
                </div>
              </div>

              {/* Dispute Info */}
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-rowan-text font-bold">Dispute Info</h3>
                  <DisputePriorityBadge priority={dispute.priority} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Dispute ID" value={formatAddress(dispute.id)} copy={dispute.id} />
                  <Field label="Status" value={dispute.status || 'open'} />
                  <Field label="Reason" value={dispute.reason || '-'} />
                  <Field label="Created" value={formatDateTime(dispute.created_at)} />
                  {dispute.resolved_at && <Field label="Resolved" value={formatDateTime(dispute.resolved_at)} />}
                  {dispute.outcome && <Field label="Outcome" value={dispute.outcome} />}
                </div>
              </div>

              {/* Timeline */}
              {dispute.timeline && dispute.timeline.length > 0 && (
                <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                  <h3 className="text-rowan-text font-bold mb-4">Timeline</h3>
                  <div className="space-y-3">
                    {dispute.timeline.map((event, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="w-2 h-2 rounded-full bg-rowan-yellow mt-1.5 shrink-0" />
                        <div>
                          <p className="text-rowan-text text-sm">{event.message}</p>
                          <p className="text-rowan-muted text-xs">{formatDateTime(event.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Actions */}
              {dispute.status !== 'resolved' && (
                <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                  <h3 className="text-rowan-text font-bold mb-3">Actions</h3>
                  <div className="space-y-2">
                    <Button className="w-full" onClick={() => setResolveModal(true)}>Resolve Dispute</Button>
                    <Button variant="ghost" className="w-full" onClick={() => setEscalateConfirm(true)} loading={actionLoading}>Escalate</Button>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
                <h3 className="text-rowan-text font-bold mb-3">Admin Notes</h3>
                {dispute.notes && dispute.notes.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {dispute.notes.map((n, i) => (
                      <div key={i} className="bg-rowan-bg rounded-lg px-3 py-2">
                        <p className="text-rowan-text text-sm">{n.text}</p>
                        <p className="text-rowan-muted text-xs mt-1">{n.author} - {formatDateTime(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1 bg-rowan-bg border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow resize-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!note.trim() || noteLoading}
                    className="text-rowan-yellow hover:text-rowan-text disabled:opacity-50 self-end p-2"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <ResolutionModal open={resolveModal} onClose={() => setResolveModal(false)} onResolve={handleResolve} loading={actionLoading} />
        <ConfirmDialog
          open={escalateConfirm}
          onClose={() => setEscalateConfirm(false)}
          onConfirm={handleEscalate}
          title="Escalate Dispute"
          message={`This will escalate dispute ${id} to a higher priority and cannot be undone. Are you sure?`}
          confirmLabel="Escalate"
          loading={actionLoading}
          variant="danger"
        />
      </div>
    </>
  )
}

function Field({ label, value, copy }) {
  return (
    <div>
      <p className="text-rowan-muted text-xs mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-rowan-text text-sm">{value}</span>
        {copy && <CopyButton value={copy} size={12} />}
      </div>
    </div>
  )
}
