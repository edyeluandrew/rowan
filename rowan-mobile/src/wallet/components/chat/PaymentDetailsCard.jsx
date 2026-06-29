import { useState } from 'react'
import { Copy, CopyCheck } from 'lucide-react'
import { getNetworkLabel } from '../../utils/p2pFormat'

function formatPhoneDisplay(phone) {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  if (digits.length <= 4) return phone
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

export default function PaymentDetailsCard({ payload, viewerRole = 'user' }) {
  const [copied, setCopied] = useState(false)
  if (!payload) return null

  const label = viewerRole === 'trader'
    ? 'Send payment using these details:'
    : 'Your trader will send payment to your mobile money. Details below:'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(payload.account_number || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="my-2">
      <p className="text-rowan-muted text-[11px] mb-2 text-center">{label}</p>
      <div className="border border-rowan-yellow/30 bg-rowan-yellow/10 rounded-xl p-4 text-sm">
        <p className="text-rowan-text font-semibold mb-3">💳 Trader Payment Details</p>
        <div className="border-t border-rowan-border/50 pt-3 space-y-2 text-rowan-text">
          <Row label="Network" value={getNetworkLabel(payload.network) || payload.network} />
          <Row label="Name" value={payload.account_name} />
          <Row
            label="Number"
            value={formatPhoneDisplay(payload.account_number)}
            action={
              <button
                type="button"
                onClick={handleCopy}
                className="text-rowan-yellow text-xs font-medium min-h-8 px-2 inline-flex items-center gap-1"
              >
                {copied ? <CopyCheck size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy number'}
              </button>
            }
          />
          <Row label="Amount" value={payload.amount} />
          <Row label="Reference" value={payload.reference} />
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-rowan-muted text-xs shrink-0">{label}</span>
      <div className="text-right flex-1 min-w-0">
        <span className="text-rowan-text text-xs font-medium break-all">{value || '—'}</span>
        {action && <div className="mt-1">{action}</div>}
      </div>
    </div>
  )
}
