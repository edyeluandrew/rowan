import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw, ShieldCheck, Clock, XCircle, Upload, Check, Loader2 } from 'lucide-react'
import { getKycStatus, submitKyc, uploadKycDocument } from '../api/user'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

function DocUploadField({ label, hint, slot, value, onUploaded, disabled }) {
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState(null)
  const inputId = `kyc-doc-${slot}`

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setFileError(null)
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File too large (max 10MB).')
      return
    }
    setUploading(true)
    try {
      const res = await uploadKycDocument(file, slot)
      onUploaded(res.key, file.name)
    } catch (err) {
      setFileError(err.response?.data?.error || 'Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="text-rowan-muted text-xs mb-1 block">{label}</label>
      <label
        htmlFor={inputId}
        className={`flex items-center gap-3 bg-rowan-surface border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
          value ? 'border-rowan-green/40' : 'border-rowan-border'
        } ${disabled || uploading ? 'opacity-60 pointer-events-none' : 'active:border-rowan-yellow'}`}
      >
        <span className="shrink-0">
          {uploading ? (
            <Loader2 size={18} className="text-rowan-yellow animate-spin" />
          ) : value ? (
            <Check size={18} className="text-rowan-green" />
          ) : (
            <Upload size={18} className="text-rowan-muted" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-rowan-text text-sm block truncate">
            {uploading ? 'Uploading…' : value ? (value.name || 'Uploaded') : 'Tap to upload'}
          </span>
          {hint && !value && <span className="text-rowan-muted text-xs block">{hint}</span>}
          {value && <span className="text-rowan-green text-xs block">Attached</span>}
        </span>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleChange}
          disabled={disabled || uploading}
        />
      </label>
      {fileError && <p className="text-rowan-red text-xs mt-1">{fileError}</p>}
    </div>
  )
}

const DOCUMENT_TYPES = [
  { value: 'NATIONAL_ID', label: 'National ID' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVERS_LICENSE', label: "Driver's license" },
]

const LEVEL_ORDER = ['NONE', 'BASIC', 'VERIFIED']

function formatUgx(n) {
  if (n == null) return '—'
  return `${Number(n).toLocaleString()} UGX`
}

export default function VerifyIdentity() {
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Form state
  const [requestedLevel, setRequestedLevel] = useState('BASIC')
  const [fullName, setFullName] = useState('')
  const [documentType, setDocumentType] = useState('NATIONAL_ID')
  const [documentNumber, setDocumentNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [documentCountry, setDocumentCountry] = useState('')
  const [frontDoc, setFrontDoc] = useState(null) // { key, name }
  const [backDoc, setBackDoc] = useState(null)
  const [selfieDoc, setSelfieDoc] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getKycStatus()
      .then((data) => {
        setStatus(data)
        const currentIdx = LEVEL_ORDER.indexOf(data.kyc_level)
        setRequestedLevel(currentIdx < 1 ? 'BASIC' : 'VERIFIED')
      })
      .catch(() => setError('Could not load your verification status.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError(null)
    if (!fullName.trim() || fullName.trim().length < 2) return setSubmitError('Enter your full legal name.')
    if (!documentNumber.trim() || documentNumber.trim().length < 3) return setSubmitError('Enter your document number.')
    if (!frontDoc?.key) return setSubmitError('Upload a photo of your document.')

    setSubmitting(true)
    try {
      await submitKyc({
        requested_level: requestedLevel,
        full_name: fullName.trim(),
        document_type: documentType,
        document_number: documentNumber.trim(),
        date_of_birth: dateOfBirth || undefined,
        document_country: documentCountry.trim() || undefined,
        document_front_url: frontDoc.key,
        document_back_url: backDoc?.key || undefined,
        selfie_url: selfieDoc?.key || undefined,
      })
      load()
    } catch (err) {
      const data = err.response?.data
      setSubmitError(data?.error || err.message || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentLevel = status?.kyc_level || 'NONE'
  const latest = status?.latest_submission
  const isPending = latest?.status === 'PENDING'
  const isRejected = latest?.status === 'REJECTED'
  const isMaxLevel = currentLevel === 'VERIFIED'
  const canUpgrade = LEVEL_ORDER.indexOf(currentLevel) < LEVEL_ORDER.length - 1
  const availableLevels = LEVEL_ORDER.slice(LEVEL_ORDER.indexOf(currentLevel) + 1)

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => navigate(-1)} className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-rowan-text text-lg font-bold">Verify identity</h1>
      </div>

      {loading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <RefreshCw size={24} className="text-rowan-yellow animate-spin" />
          <p className="text-rowan-muted text-sm">Loading…</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 text-center mb-4">
          <p className="text-rowan-red text-sm">{error}</p>
          <button type="button" onClick={load} className="text-rowan-yellow text-sm mt-2">Try again</button>
        </div>
      )}

      {!loading && !error && status && (
        <>
          {/* Current level + limits */}
          <div className="bg-rowan-surface rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-rowan-muted text-xs uppercase tracking-wider">Current level</p>
                <p className="text-rowan-text text-xl font-bold">{currentLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-rowan-muted text-xs">Daily limit</p>
                <p className="text-rowan-text text-sm font-semibold tabular-nums">{formatUgx(status.limits?.daily)}</p>
              </div>
            </div>
            <p className="text-rowan-muted text-xs mt-2">
              Per transaction: {formatUgx(status.limits?.perTx)}
            </p>
          </div>

          {/* Tier ladder */}
          {status.tiers && (
            <div className="bg-rowan-surface rounded-xl p-4 mb-4">
              <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">Limits by level</p>
              <div className="space-y-2">
                {LEVEL_ORDER.map((lvl) => (
                  <div key={lvl} className={`flex items-center justify-between text-sm ${lvl === currentLevel ? 'text-rowan-yellow' : 'text-rowan-muted'}`}>
                    <span className="font-medium">{lvl}{lvl === currentLevel ? ' · you' : ''}</span>
                    <span className="tabular-nums">{formatUgx(status.tiers[lvl]?.daily)} / day</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* State: fully verified */}
          {isMaxLevel && (
            <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4 flex items-center gap-3">
              <ShieldCheck size={20} className="text-rowan-green shrink-0" />
              <p className="text-rowan-text text-sm">You're fully verified. Enjoy the highest limits.</p>
            </div>
          )}

          {/* State: pending review */}
          {!isMaxLevel && isPending && (
            <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4 flex items-center gap-3">
              <Clock size={20} className="text-rowan-yellow shrink-0" />
              <div>
                <p className="text-rowan-text text-sm font-medium">Under review</p>
                <p className="text-rowan-muted text-xs mt-0.5">
                  Your request to reach {latest.requested_level} is being reviewed. We'll notify you once it's done.
                </p>
              </div>
            </div>
          )}

          {/* State: form (not pending, can upgrade) */}
          {!isMaxLevel && !isPending && canUpgrade && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRejected && (
                <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 flex items-start gap-3">
                  <XCircle size={18} className="text-rowan-red shrink-0 mt-0.5" />
                  <div>
                    <p className="text-rowan-text text-sm font-medium">Previous submission was not approved</p>
                    {latest.review_notes && <p className="text-rowan-muted text-xs mt-0.5">{latest.review_notes}</p>}
                    <p className="text-rowan-muted text-xs mt-1">Please check your details and submit again.</p>
                  </div>
                </div>
              )}

              {availableLevels.length > 1 && (
                <div>
                  <label className="text-rowan-muted text-xs mb-1 block">Verification level</label>
                  <select
                    value={requestedLevel}
                    onChange={(e) => setRequestedLevel(e.target.value)}
                    className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-4 w-full text-sm focus:outline-none focus:border-rowan-yellow min-h-11"
                  >
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-rowan-muted text-xs mb-1 block">Full legal name</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="As it appears on your ID" />
              </div>

              <div>
                <label className="text-rowan-muted text-xs mb-1 block">Document type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-4 py-4 w-full text-sm focus:outline-none focus:border-rowan-yellow min-h-11"
                >
                  {DOCUMENT_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-rowan-muted text-xs mb-1 block">Document number</label>
                <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Document / ID number" />
              </div>

              <div>
                <label className="text-rowan-muted text-xs mb-1 block">Date of birth (optional)</label>
                <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>

              <div>
                <label className="text-rowan-muted text-xs mb-1 block">Country of issue (optional)</label>
                <Input value={documentCountry} onChange={(e) => setDocumentCountry(e.target.value)} placeholder="e.g. UG" />
              </div>

              <div className="pt-1 space-y-3">
                <p className="text-rowan-muted text-xs uppercase tracking-wider">Document photos</p>
                <DocUploadField
                  label="Document front"
                  hint="Clear photo of the front of your ID"
                  slot="front"
                  value={frontDoc}
                  onUploaded={(key, name) => setFrontDoc({ key, name })}
                  disabled={submitting}
                />
                <DocUploadField
                  label="Document back (optional)"
                  hint="Back of your ID, if applicable"
                  slot="back"
                  value={backDoc}
                  onUploaded={(key, name) => setBackDoc({ key, name })}
                  disabled={submitting}
                />
                <DocUploadField
                  label="Selfie (optional)"
                  hint="A photo of you holding your ID"
                  slot="selfie"
                  value={selfieDoc}
                  onUploaded={(key, name) => setSelfieDoc({ key, name })}
                  disabled={submitting}
                />
              </div>

              {submitError && (
                <p className="text-rowan-red text-sm">{submitError}</p>
              )}

              <p className="text-rowan-muted text-xs">
                By submitting you confirm these details are accurate. Rowan reviews every request and may contact you for more information.
              </p>

              <Button type="submit" loading={submitting}>Submit for verification</Button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
