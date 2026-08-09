import { AlertTriangle, HelpCircle, Info } from 'lucide-react'

const URGENCY_CLASS = {
  normal: 'bg-rowan-surface border-rowan-border',
  soon: 'bg-rowan-yellow/10 border-rowan-yellow/35',
  critical: 'bg-rowan-red/10 border-rowan-red/35',
}

const TITLE_CLASS = {
  normal: 'text-rowan-text',
  soon: 'text-rowan-yellow',
  critical: 'text-rowan-red',
}

/**
 * “What should I do now?” panel for live P2P orders.
 */
export default function OrderGuidanceCard({
  guidance,
  onCancel,
  onDispute,
  canCancel = false,
  canDispute = false,
}) {
  if (!guidance) return null
  const urgency = guidance.urgency || 'normal'
  const Icon = urgency === 'critical' ? AlertTriangle : urgency === 'soon' ? AlertTriangle : Info

  return (
    <div className={`rounded-xl border p-4 mb-4 ${URGENCY_CLASS[urgency] || URGENCY_CLASS.normal}`}>
      <div className="flex items-start gap-3">
        <Icon
          size={18}
          className={`shrink-0 mt-0.5 ${TITLE_CLASS[urgency] || TITLE_CLASS.normal}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${TITLE_CLASS[urgency] || TITLE_CLASS.normal}`}>
            {guidance.title}
          </p>
          <p className="text-rowan-muted text-xs mt-1.5 leading-relaxed">
            {guidance.body}
          </p>
          {guidance.tip && (
            <div className="flex items-start gap-1.5 mt-2.5">
              <HelpCircle size={12} className="text-rowan-muted shrink-0 mt-0.5" />
              <p className="text-rowan-muted text-[11px] leading-relaxed">{guidance.tip}</p>
            </div>
          )}
          {(canCancel || canDispute) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {canCancel && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs font-medium text-rowan-red border border-rowan-red/40 rounded-lg px-3 py-2 min-h-9"
                >
                  Cancel order
                </button>
              )}
              {canDispute && onDispute && (
                <button
                  type="button"
                  onClick={onDispute}
                  className="text-xs font-medium text-rowan-yellow border border-rowan-yellow/40 rounded-lg px-3 py-2 min-h-9"
                >
                  Raise a dispute
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
