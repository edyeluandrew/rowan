import { useState } from 'react'
import Modal from '../../../shared/components/ui/Modal'
import Button from '../../../shared/components/ui/Button'
import { DISPUTE_OUTCOMES, DISPUTE_NOTE_MIN_LENGTH } from '../../../shared/utils/constants'

export default function ResolutionModal({ open, onClose, onResolve, loading = false }) {
  const [outcome, setOutcome] = useState('')
  const [notes, setNotes] = useState('')
  const [noteError, setNoteError] = useState('')

  const handleSubmit = () => {
    if (!outcome) return
    if (notes.trim().length < DISPUTE_NOTE_MIN_LENGTH) {
      setNoteError(`Resolution notes must be at least ${DISPUTE_NOTE_MIN_LENGTH} characters.`)
      return
    }
    setNoteError('')
    onResolve({ outcome, notes })
  }

  const handleClose = () => {
    setOutcome('')
    setNotes('')
    setNoteError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Resolve Dispute"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!outcome || notes.trim().length < DISPUTE_NOTE_MIN_LENGTH}>Resolve</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-rowan-muted text-xs block mb-2">Outcome</label>
          <div className="space-y-2">
            {Object.entries(DISPUTE_OUTCOMES).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setOutcome(key)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  outcome === key
                    ? 'border-rowan-yellow bg-rowan-yellow/10 text-rowan-text'
                    : 'border-rowan-border text-rowan-muted hover:text-rowan-text'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-rowan-muted text-xs block mb-1">Admin Notes</label>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNoteError('') }}
            placeholder="Resolution reason..."
            rows={3}
            className="w-full bg-rowan-bg border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow resize-none"
          />
          {noteError && <p className="text-rowan-red text-xs mt-1">{noteError}</p>}
        </div>
      </div>
    </Modal>
  )
}
