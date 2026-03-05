import { Lock, ExternalLink, AlertTriangle } from 'lucide-react'
import { formatXlm } from '../../utils/format'
import { MIN_ESCROW_XLM_RESERVE, STELLAR_EXPLORER_URL } from '../../utils/constants'

export default function EscrowBalanceCard({ status = {}, loading = false }) {
  const isLow = (status.xlm_balance || 0) < MIN_ESCROW_XLM_RESERVE

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

      {isLow && (
        <div className="flex items-center gap-2 bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-3 py-2 text-sm mb-4">
          <AlertTriangle size={14} />
          <span>XLM balance below minimum reserve ({MIN_ESCROW_XLM_RESERVE} XLM)</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">XLM Balance</p>
          <p className={`text-xl font-bold ${isLow ? 'text-rowan-red' : 'text-rowan-text'}`}>
            {formatXlm(status.xlm_balance)}
          </p>
        </div>
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">USDC Balance</p>
          <p className="text-rowan-text text-xl font-bold">{formatXlm(status.usdc_balance)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Locked</p>
          <p className="text-rowan-text text-sm">{formatXlm(status.locked_amount)} XLM</p>
        </div>
        <div>
          <p className="text-rowan-muted text-xs uppercase tracking-wider mb-1">Active Locks</p>
          <p className="text-rowan-text text-sm">{status.active_locks || 0}</p>
        </div>
      </div>

      {status.account_id && (
        <a
          href={`${STELLAR_EXPLORER_URL}/accounts/${status.account_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-rowan-yellow text-sm hover:underline"
        >
          <span>View on Stellar Explorer</span>
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  )
}
