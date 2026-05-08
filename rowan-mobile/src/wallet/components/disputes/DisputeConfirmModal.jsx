import { AlertTriangle } from 'lucide-react'
import Button from '../ui/Button'

export default function DisputeConfirmModal({ onConfirm, onCancel, isLoading }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-rowan-surface rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-rowan-red" />
        </div>

        <h2 className="text-rowan-text text-lg font-bold text-center mb-2">
          Open Dispute
        </h2>

        <p className="text-rowan-muted text-sm text-center mb-6 leading-relaxed">
          Only open a dispute if the money has not arrived in your mobile money account.
        </p>

        <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-lg p-3 mb-6">
          <p className="text-rowan-yellow text-xs leading-relaxed">
            USDC will remain locked in escrow while admin reviews the case.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={onConfirm}
            loading={isLoading}
            className="flex-1"
          >
            Open Dispute
          </Button>
        </div>
      </div>
    </div>
  )
}
