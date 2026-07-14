import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { CURRENT_NETWORK } from '../../utils/constants'

/**
 * Shows dispute-related status message based on transaction state.
 */
export default function DisputeStatusCard({ state, data = {} }) {
  const refundHash = data.stellar_refund_tx || data.dispute_refund_tx || null
  const refundExplorerUrl = refundHash ? `${CURRENT_NETWORK.explorerUrl}/tx/${refundHash}` : null
  const missingTrustline = (data.refund_error || '').startsWith('USER_MISSING_USDC_TRUSTLINE')
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
    // Blocked because the user's wallet cannot receive USDC yet.
    if (missingTrustline) {
      return (
        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-rowan-text font-semibold text-sm">Refund Waiting for USDC Trustline</h3>
              <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
                Your dispute was resolved in your favor, but your wallet must be able to receive USDC before the refund can complete.
              </p>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Clock size={20} className="text-rowan-yellow flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-rowan-text font-semibold text-sm">Refund Processing</h3>
            <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
              Admin resolved this dispute in your favor. Your escrowed USDC is being returned to your wallet.
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
    // Distinguish a dispute (user-win USDC) refund from a plain auto-refund.
    const isDisputeRefund = !!data.dispute_id
    return (
      <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={20} className="text-rowan-green flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-rowan-text font-semibold text-sm">Refund Complete</h3>
            {isDisputeRefund ? (
              <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
                This dispute was resolved in your favor. The escrowed USDC was returned to your wallet.
              </p>
            ) : (
              <p className="text-rowan-muted text-sm mt-1 leading-relaxed">
                The escrowed funds were returned to your wallet.
              </p>
            )}
            {refundHash && (
              <a
                href={refundExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rowan-yellow text-xs mt-2 inline-block underline break-all"
              >
                Refund tx: {refundHash.slice(0, 12)}…{refundHash.slice(-6)}
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
