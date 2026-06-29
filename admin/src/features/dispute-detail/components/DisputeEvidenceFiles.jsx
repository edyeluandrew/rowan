import { useEffect, useState } from 'react'
import { FileText, Download } from 'lucide-react'
import { getDisputeEvidence } from '../../../shared/services/api/disputes'
import { formatDateTime } from '../../../shared/utils/format'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'

export default function DisputeEvidenceFiles({ disputeId }) {
  const [evidence, setEvidence] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!disputeId) return
    let cancelled = false
    setLoading(true)
    getDisputeEvidence(disputeId)
      .then((data) => { if (!cancelled) setEvidence(data) })
      .catch(() => { if (!cancelled) setError('Could not load evidence files') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [disputeId])

  if (!disputeId) return null

  const userFiles = evidence.filter((e) => e.uploaderRole === 'user')
  const traderFiles = evidence.filter((e) => e.uploaderRole === 'trader')

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
      <h3 className="text-rowan-text font-bold mb-4">Evidence Files</h3>
      {loading && (
        <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
      )}
      {error && (
        <p className="text-rowan-red text-sm">{error}</p>
      )}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EvidenceColumn title="From user" files={userFiles} />
          <EvidenceColumn title="From trader" files={traderFiles} />
        </div>
      )}
    </div>
  )
}

function EvidenceColumn({ title, files }) {
  return (
    <div>
      <h4 className="text-rowan-muted text-xs uppercase tracking-wider mb-3">{title}</h4>
      {files.length === 0 ? (
        <p className="text-rowan-muted text-sm">No files uploaded</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <EvidenceItem key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}

function EvidenceItem({ file }) {
  const isPdf = (file.fileType || '').includes('pdf')
  return (
    <div className="flex items-start gap-3 bg-rowan-bg rounded-lg p-3">
      <div className="w-12 h-12 rounded bg-rowan-surface flex items-center justify-center shrink-0 overflow-hidden">
        {isPdf || !file.fileUrl ? (
          <FileText size={20} className="text-rowan-muted" />
        ) : (
          <img src={file.fileUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-rowan-text text-sm truncate">{file.fileName}</p>
        <p className="text-rowan-muted text-xs">{formatDateTime(file.uploadedAt)}</p>
        {file.fileUrl && (
          <a
            href={file.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-rowan-yellow text-xs mt-1"
          >
            <Download size={12} />
            Download
          </a>
        )}
      </div>
    </div>
  )
}
