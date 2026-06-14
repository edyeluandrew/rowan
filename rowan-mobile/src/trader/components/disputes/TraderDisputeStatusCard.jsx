import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

/**
 * Shows dispute-related status message for traders based on transaction state.
 */
export default function TraderDisputeStatusCard({ state, data = {} }) {
  if (state === 'FIAT_PAYOUT_SUBMITTED') {
    return (
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Payment Submitted</h3>
            <p className="text-rowan-muted text-sm mt-1">
              We are waiting for the customer to confirm receipt.
            </p>
            <p className="text-rowan-muted text-sm mt-1">
              USDC will be released after confirmation.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'DISPUTE_OPENED') {
    return (
      <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="text-rowan-red flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Opened</h3>
            <p className="text-rowan-muted text-sm mt-1">
              The customer reported that they did not receive the mobile money.
            </p>
            <p className="text-rowan-muted text-sm mt-1 font-medium">
              Please wait while admin reviews the case.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'DISPUTE_RELEASE_PENDING') {
    return (
      <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-rowan-green flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Resolved in Your Favor</h3>
            <p className="text-rowan-muted text-sm mt-1">
              Admin approved the payout.
            </p>
            <p className="text-rowan-muted text-sm mt-1">
              USDC release is being finalized.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'DISPUTE_REFUND_PENDING') {
    return (
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock size={20} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Resolved for Customer</h3>
            <p className="text-rowan-muted text-sm mt-1">
              Admin resolved this dispute for the customer. USDC will not be released to you.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'REFUNDED') {
    return (
      <div className="bg-rowan-muted/10 border border-rowan-muted/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-rowan-muted flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Closed</h3>
            <p className="text-rowan-muted text-sm mt-1">
              This dispute was resolved for the customer. The escrowed USDC was returned to the customer.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
