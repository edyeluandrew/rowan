import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, CopyCheck, Hash } from 'lucide-react'
import AddressDisplay from '../wallet/AddressDisplay'
import { COPY_FEEDBACK_TIMEOUT_MS } from '../../utils/constants'

/**
 * Collapsible escrow payment details for external-wallet edge cases.
 * Hidden by default — in-app Send attaches memo automatically.
 */
export default function CashoutPaymentDetails({ escrowAddress, xlmAmount, memo }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4 border border-rowan-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-rowan-surface min-h-11"
      >
        <span className="text-rowan-muted text-sm">Payment details (external wallet)</span>
        {open ? (
          <ChevronUp size={18} className="text-rowan-muted" />
        ) : (
          <ChevronDown size={18} className="text-rowan-muted" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-rowan-surface space-y-3 border-t border-rowan-border">
          <p className="text-rowan-muted text-xs pt-3">
            Only needed if sending from another Stellar wallet. Rowan attaches these automatically when you tap Send XLM.
          </p>

          <DetailField label="Amount" value={`${xlmAmount} XLM`} copyValue={String(xlmAmount)} />
          <div>
            <p className="text-rowan-muted text-xs mb-1">Escrow address</p>
            <div className="bg-rowan-bg rounded-lg p-3">
              <AddressDisplay address={escrowAddress} />
            </div>
            <CopyButton value={escrowAddress} />
          </div>
          <div>
            <p className="text-rowan-muted text-xs mb-1 flex items-center gap-1">
              <Hash size={12} /> Memo
            </p>
            <p className="text-rowan-yellow font-mono text-sm break-all">{memo}</p>
            <CopyButton value={memo} />
          </div>
        </div>
      )}
    </div>
  )
}

function DetailField({ label, value, copyValue }) {
  return (
    <div>
      <p className="text-rowan-muted text-xs mb-1">{label}</p>
      <p className="text-rowan-text text-sm font-medium tabular-nums">{value}</p>
      {copyValue != null && <CopyButton value={copyValue} />}
    </div>
  )
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), COPY_FEEDBACK_TIMEOUT_MS)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 mt-1 text-rowan-muted text-xs min-h-9"
    >
      {copied ? <CopyCheck size={14} className="text-rowan-green" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
