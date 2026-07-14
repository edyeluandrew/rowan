import { CheckCircle2, AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'

/**
 * Shows confirmation/dispute buttons for FIAT_PAYOUT_SUBMITTED state.
 */
export default function ReceiptConfirmationCard({ onConfirmReceipt, onOpenDispute, isLoading }) {
  return (
    <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4">
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle2 size={20} className="text-rowan-green flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-rowan-text font-semibold text-sm">Money Sent by Trader</h3>
          <p className="text-rowan-muted text-sm mt-1">
            The trader says they sent the mobile money.
          </p>
          <p className="text-rowan-muted text-sm mt-1 font-medium">
            Did you receive it?
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirmReceipt}
          loading={isLoading}
          className="flex-1"
        >
          Yes, I received it
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenDispute}
          disabled={isLoading}
          className="flex-1"
        >
          I did not receive it
        </Button>
      </div>
    </div>
  )
}
