import { useState } from 'react'
import { Copy, CopyCheck, Hash, TriangleAlert, Circle, CircleCheck } from 'lucide-react'
import AddressDisplay from '../wallet/AddressDisplay'

/**
 * MemoBox — displays the escrow address, amount, and memo
 * that the user must send to. Includes a 3-step checklist.
 */
export default function MemoBox({ escrowAddress, xlmAmount, memo, allChecked, onAllChecked }) {
  const [checks, setChecks] = useState([false, false, false])

  const toggleCheck = (idx) => {
    const next = [...checks]
    next[idx] = !next[idx]
    setChecks(next)
    if (next.every(Boolean) && !allChecked) onAllChecked(true)
    else if (!next.every(Boolean) && allChecked) onAllChecked(false)
  }

  const steps = [
    'Copy the address',
    'Enter the exact amount',
    'Add the memo before sending',
  ]

  return (
    <div className="space-y-4">
      {/* Amount box */}
      <div>
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Send exactly</p>
        <CopyableBox
          value={String(xlmAmount)}
          display={<span className="text-rowan-yellow text-3xl font-bold tabular-nums">{xlmAmount} XLM</span>}
          borderClass="border-rowan-yellow"
        />
      </div>

      {/* Address box */}
      <div>
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">To this address</p>
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4">
          <AddressDisplay address={escrowAddress} />
          <p className="text-rowan-text font-mono text-xs break-all mt-2">{escrowAddress}</p>
        </div>
      </div>

      {/* Memo box */}
      <div>
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">With this exact memo</p>
        <CopyableBox
          value={memo}
          display={
            <div className="flex items-center gap-2 justify-center">
              <Hash size={14} className="text-rowan-yellow" />
              <span className="text-rowan-yellow font-mono font-bold text-lg">{memo}</span>
            </div>
          }
          borderClass="border-rowan-yellow"
        />
        <div className="flex items-start gap-2 mt-2">
          <TriangleAlert size={14} className="text-rowan-red flex-shrink-0 mt-0.5" />
          <span className="text-rowan-red text-xs">
            The memo is required. Transactions without the correct memo cannot be detected
          </span>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-3 mt-4">
        {steps.map((step, idx) => (
          <button
            key={idx}
            onClick={() => toggleCheck(idx)}
            className="flex items-center gap-2 w-full text-left min-h-11"
          >
            {checks[idx] ? (
              <CircleCheck size={20} className="text-rowan-green flex-shrink-0" />
            ) : (
              <Circle size={20} className="text-rowan-muted flex-shrink-0" />
            )}
            <span className={`text-sm ${checks[idx] ? 'text-rowan-text' : 'text-rowan-muted'}`}>
              {idx + 1}. {step}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CopyableBox({ value, display, borderClass = 'border-rowan-border' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard not available */
    }
  }

  return (
    <div className={`bg-rowan-surface border ${borderClass} rounded-xl p-4 text-center`}>
      {display}
      <button onClick={handleCopy} className="flex items-center gap-1.5 mx-auto mt-2 text-rowan-muted text-xs">
        {copied ? <CopyCheck size={15} className="text-rowan-green" /> : <Copy size={15} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  )
}
