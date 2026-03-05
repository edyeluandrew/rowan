import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fileDispute } from '../api/cashout'
import Button from '../components/ui/Button'
import Textarea from '../components/ui/Textarea'

const REASONS = [
  'Did not receive mobile money',
  'Received wrong amount',
  'Received late (past SLA)',
  'Other issue',
]

export default function DisputeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reason, setReason] = useState(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!reason) return
    setLoading(true)
    setError(null)
    try {
      await fileDispute({
        transactionId: id,
        reason,
        description: description.trim().slice(0, 1000),
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="bg-rowan-bg min-h-screen flex flex-col items-center justify-center px-6">
        <div className="animate-scale-in">
          <CheckCircle2 size={64} className="text-rowan-green mx-auto" />
        </div>
        <h2 className="text-rowan-text text-xl font-bold mt-6">Dispute Filed</h2>
        <p className="text-rowan-muted text-sm text-center mt-2 max-w-xs">
          Our team will review your dispute and get back to you within 24 hours.
        </p>
        <div className="mt-8 w-full">
          <Button onClick={() => navigate('/home', { replace: true })}>
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">File Dispute</h1>
      </div>

      <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-6 flex items-start gap-3">
        <AlertTriangle size={20} className="text-rowan-red shrink-0 mt-0.5" />
        <div>
          <p className="text-rowan-red text-sm font-medium">Important</p>
          <p className="text-rowan-muted text-xs mt-1">
            Disputes must be filed within 24 hours of transaction completion.
            False disputes may result in account restrictions.
          </p>
        </div>
      </div>

      <h3 className="text-rowan-text text-sm font-semibold mb-3">Reason</h3>
      <div className="flex flex-wrap gap-2 mb-6">
        {REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`px-3 py-2 rounded-full text-xs transition-colors min-h-9 ${
              reason === r
                ? 'bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/30'
                : 'bg-rowan-surface text-rowan-muted border border-rowan-border'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <h3 className="text-rowan-text text-sm font-semibold mb-3">Description (optional)</h3>
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Provide any additional details..."
        rows={4}
      />

      {error && <p className="text-rowan-red text-sm mt-4">{error}</p>}

      <div className="mt-8">
        <Button onClick={handleSubmit} loading={loading} disabled={!reason} variant="danger">
          Submit Dispute
        </Button>
      </div>
    </div>
  )
}
