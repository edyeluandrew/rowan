import { useState, useEffect } from 'react'
import { FileText, Upload } from 'lucide-react'
import { formatTimeAgo } from '../../utils/format'

const MAX_FILES = 5

export default function DisputeEvidenceSection({
  disputeId,
  uploadEvidence,
  listEvidence,
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!disputeId) return
    let cancelled = false
    setLoading(true)
    listEvidence(disputeId)
      .then((data) => { if (!cancelled) setFiles(data) })
      .catch(() => { if (!cancelled) setError('Could not load evidence files') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [disputeId, listEvidence])

  const handlePick = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !disputeId) return
    if (files.length >= MAX_FILES) {
      setError('Maximum evidence files reached')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const row = await uploadEvidence(disputeId, file)
      setFiles((prev) => [...prev, row])
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!disputeId) return null

  return (
    <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 my-4">
      <h3 className="text-rowan-text text-sm font-semibold mb-2">Upload Evidence</h3>
      <p className="text-rowan-muted text-xs mb-3">
        Add screenshots or PDFs to support your dispute (max {MAX_FILES} files).
      </p>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-rowan-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              {files.map((f) => (
                <EvidenceThumb key={f.id} file={f} />
              ))}
            </div>
          )}
          {files.length >= MAX_FILES ? (
            <p className="text-rowan-muted text-xs">Maximum evidence files reached</p>
          ) : (
            <label className="inline-flex items-center gap-2 cursor-pointer text-rowan-yellow text-sm font-medium min-h-11">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handlePick}
                disabled={uploading}
              />
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-rowan-yellow border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </span>
              ) : (
                <>
                  <Upload size={14} />
                  Add evidence
                </>
              )}
            </label>
          )}
        </>
      )}
      {error && <p className="text-rowan-red text-xs mt-2">{error}</p>}
    </div>
  )
}

function EvidenceThumb({ file }) {
  const isPdf = (file.fileType || '').includes('pdf')
  return (
    <div className="border border-rowan-border rounded-lg p-2 bg-rowan-bg">
      <div className="h-16 flex items-center justify-center rounded bg-rowan-surface mb-2 overflow-hidden">
        {isPdf || !file.fileUrl ? (
          <FileText size={24} className="text-rowan-muted" />
        ) : (
          <img src={file.fileUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <p className="text-rowan-text text-[10px] truncate">{file.fileName}</p>
      <p className="text-rowan-muted text-[10px]">{formatTimeAgo(file.uploadedAt)}</p>
    </div>
  )
}
