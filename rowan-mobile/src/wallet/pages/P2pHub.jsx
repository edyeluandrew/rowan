import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Zap } from 'lucide-react'
import useActiveTransaction from '../hooks/useActiveTransaction'
import Button from '../components/ui/Button'

/**
 * P2P hub — separate Buy / Sell actions (click → leave to that flow).
 */
export default function P2pHub() {
  const navigate = useNavigate()
  const { activeTransaction, hasActiveOrder } = useActiveTransaction()

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-rowan-text text-lg font-bold mb-2">P2P</h1>
      <p className="text-rowan-muted text-sm mb-6">
        Trade with verified partners using mobile money.
      </p>

      {hasActiveOrder && activeTransaction && (
        <div className="bg-rowan-yellow rounded-xl p-4 mb-4">
          <p className="text-rowan-bg text-sm font-semibold">
            You have an active order. Finish it before starting another.
          </p>
          <Button
            className="mt-3 bg-rowan-bg text-rowan-text hover:bg-rowan-bg/90"
            onClick={() => navigate(`/wallet/transaction/${activeTransaction.id}`)}
          >
            View order
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          disabled={hasActiveOrder}
          onClick={() => navigate('/wallet/marketplace', { state: { tab: 'buy' } })}
          className="w-full flex items-center gap-3 bg-rowan-yellow text-rowan-bg font-semibold rounded-xl px-4 py-4 min-h-11 disabled:opacity-50"
        >
          <ArrowDownToLine size={20} />
          <span className="flex-1 text-left">
            <span className="block text-base">Buy</span>
            <span className="block text-xs font-medium opacity-80">Pay MoMo · get USDC</span>
          </span>
        </button>

        <button
          type="button"
          disabled={hasActiveOrder}
          onClick={() => navigate('/wallet/marketplace', { state: { tab: 'sell' } })}
          className="w-full flex items-center gap-3 bg-rowan-surface border border-rowan-border text-rowan-text font-semibold rounded-xl px-4 py-4 min-h-11 disabled:opacity-50"
        >
          <ArrowUpFromLine size={20} className="text-rowan-yellow" />
          <span className="flex-1 text-left">
            <span className="block text-base">Sell</span>
            <span className="block text-xs font-medium text-rowan-muted">Send USDC · get MoMo</span>
          </span>
        </button>
      </div>

      <button
        type="button"
        disabled={hasActiveOrder}
        onClick={() => navigate('/wallet/cashout')}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-rowan-bg border border-rowan-border rounded-xl px-4 py-3 min-h-11 text-rowan-muted text-sm disabled:opacity-50"
      >
        <Zap size={16} className="text-rowan-yellow" />
        Express sell · auto-match
      </button>
    </div>
  )
}
