import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'

/**
 * Shows dispute-related status message based on transaction state.
 */
export default function DisputeStatusCard({ state, data = {} }) {
  if (state === 'DISPUTE_OPENED') {
    return (
      <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="text-rowan-red flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Under Review</h3>
            <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
              You reported that you did not receive the mobile money.
            </p>
            <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
              Our admin team will review the trader's payout reference and transaction details.
            </p>
            <p className="text-rowan-muted text-sm mt-2 font-medium">
              USDC is still locked in escrow.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'DISPUTE_RELEASE_PENDING') {
    return (
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock size={20} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Resolution in Progress</h3>
            <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
              Admin has approved release to the trader.
            </p>
            <p className="text-rowan-muted text-sm mt-1">
              We are finalizing the escrow release.
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
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Resolution in Progress</h3>
            <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
              Admin has resolved this case in your favor.
            </p>
            <p className="text-rowan-muted text-sm mt-1">
              We are finalizing the transaction status.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'RELEASE_BLOCKED') {
    return (
      <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-rowan-red flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Release Blocked</h3>
            <p className="text-rowan-muted text-sm mt-1">
              This transaction cannot be completed at this time. Please contact support.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'REFUNDED') {
    return (
      <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-rowan-green flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Dispute Resolved</h3>
            <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
              This transaction was resolved in your favor.
            </p>
            <p className="text-rowan-muted text-sm mt-1">
              The trader did not receive the escrowed USDC.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return null
}
