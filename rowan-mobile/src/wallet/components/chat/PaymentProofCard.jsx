import { useState } from 'react'
import { getNetworkLabel, formatMessageTime } from '../../utils/p2pFormat'

export default function PaymentProofCard({ payload }) {
  const [expandedImage, setExpandedImage] = useState(null)
  if (!payload) return null

  const sentAt = payload.submitted_at
    ? formatMessageTime(payload.submitted_at)
    : ''

  return (
    <div className="my-2">
      <p className="text-rowan-muted text-[11px] mb-2 text-center">
        Your trader has sent payment. Check your mobile money and confirm below.
      </p>
      <div className="border-l-4 border-rowan-green bg-rowan-green/10 rounded-xl p-4 text-sm">
        <p className="text-rowan-text font-semibold mb-3">✅ Trader Payment Proof</p>
        <div className="border-t border-rowan-border/50 pt-3 space-y-2 text-rowan-text">
          <Row label="Network" value={getNetworkLabel(payload.network) || payload.network} />
          <Row label="Reference" value={payload.reference} />
          <Row label="Amount" value={payload.amount} />
          {sentAt && <Row label="Sent at" value={sentAt} />}
        </div>
        {payload.proof_url && (
          <button
            type="button"
            onClick={() => setExpandedImage(payload.proof_url)}
            className="mt-3 block w-full"
          >
            <img
              src={payload.proof_url}
              alt="Payment proof"
              className="rounded-lg max-h-32 w-full object-cover border border-rowan-border"
            />
            <span className="text-rowan-muted text-[10px] mt-1 block">Tap to expand</span>
          </button>
        )}
      </div>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="Payment proof full size" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-rowan-muted text-xs shrink-0">{label}</span>
      <span className="text-rowan-text text-xs font-medium text-right break-all">{value || '—'}</span>
    </div>
  )
}
