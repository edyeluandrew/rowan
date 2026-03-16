import { Lock } from 'lucide-react'
import { formatUsdc } from '../../utils/format'

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
          <p className="text-rowan-text text-xl font-bold">{formatUsdc(status.total_locked)} USDC</p>
        </div>
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Active Escrows</p>
          <p className="text-rowan-text text-xl font-bold">{status.active_escrows || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Released Today</p>
          <p className="text-rowan-text text-sm">{formatUsdc(status.released_today)} USDC</p>
        </div>
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Refunded Today</p>
          <p className="text-rowan-text text-sm">{formatUsdc(status.refunded_today)} USDC</p>
        </div>
      </div>
    </div>
  )
}
