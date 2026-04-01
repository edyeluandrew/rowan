import { Lock } from 'lucide-react'
import { formatUsdc } from '../../../shared/utils/format'

export default function EscrowBalanceCard({ status = {}, loading = false }) {
  if (loading) {
    return (
      <div className="bg-rowan-surface rounded-xl border border-rowan-border p-6">
        <div className="h-24 bg-rowan-border/30 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-rowan-surface rounded-xl border border-rowan-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <Lock size={20} className="text-rowan-yellow" />
        <h3 className="text-rowan-text font-bold text-lg">Escrow Account</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Total Locked</p>
          <p className="text-rowan-text text-2xl font-bold">{formatUsdc(status.total_locked_usdc || 0)} <span className="text-sm">USDC</span></p>
        </div>
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Transactions</p>
          <p className="text-rowan-text text-2xl font-bold">{status.locked_transaction_count || 0}</p>
        </div>
      </div>

      {status.oldest_lock && (
        <p className="text-rowan-muted text-xs">Oldest lock: {new Date(status.oldest_lock).toLocaleDateString()}</p>
      )}
    </div>
  )
}
