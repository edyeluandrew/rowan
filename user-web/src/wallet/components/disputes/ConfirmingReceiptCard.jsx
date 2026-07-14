import { Clock } from 'lucide-react'

/**
 * Shows status when user has confirmed receipt and escrow release is in progress.
 */
export default function ConfirmingReceiptCard() {
  return (
    <div className="bg-rowan-green/10 border border-rowan-green/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Clock size={20} className="text-rowan-green flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-rowan-text font-semibold text-sm">Confirming Receipt</h3>
          <p className="text-rowan-muted text-sm mt-1">
            You confirmed that you received the mobile money.
          </p>
          <p className="text-rowan-muted text-sm mt-1">
            We are releasing escrowed USDC to the trader.
          </p>
        </div>
      </div>
    </div>
  )
}
