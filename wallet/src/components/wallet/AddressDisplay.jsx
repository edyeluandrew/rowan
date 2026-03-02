import { useState } from 'react'
import { Copy, CopyCheck } from 'lucide-react'
import { truncateAddress } from '../../utils/crypto'

/**
 * Stellar address display with copy button and truncation.
 */
export default function AddressDisplay({ address, label, className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-rowan-muted text-xs">{label}</span>}
      <span className="text-rowan-text font-mono text-sm">{truncateAddress(address)}</span>
      <button onClick={handleCopy} className="text-rowan-muted p-1">
        {copied ? (
          <CopyCheck size={15} className="text-rowan-green" />
        ) : (
          <Copy size={15} />
        )}
      </button>
    </div>
  )
}
