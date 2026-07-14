import { useState } from 'react'
import { Copy, CopyCheck } from 'lucide-react'
import { formatShortId } from '../../utils/p2pFormat'

export default function OrderShortId({ transactionId, className = '' }) {
  const [copied, setCopied] = useState(false)
  const shortId = formatShortId(transactionId)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!transactionId) return null

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-rowan-muted text-xs min-h-8 ${className}`}
    >
      <span>Order {shortId}</span>
      {copied ? <CopyCheck size={12} className="text-rowan-green" /> : <Copy size={12} />}
      {copied && <span className="text-rowan-green text-[10px]">Copied!</span>}
    </button>
  )
}
