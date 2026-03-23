import { useState } from 'react'
import { Copy, CopyCheck } from 'lucide-react'
import { COPY_FEEDBACK_TIMEOUT_MS } from '../../utils/constants'

export default function CopyButton({ value, size = 14 }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <button onClick={handleCopy} className="text-rowan-muted hover:text-rowan-text p-0.5 shrink-0">
      {copied ? (
        <CopyCheck size={size} className="text-rowan-green" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  )
}
