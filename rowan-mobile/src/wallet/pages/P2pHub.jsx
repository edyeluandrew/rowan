import { useNavigate } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Zap } from 'lucide-react'
import useActiveTransaction from '../hooks/useActiveTransaction'
import Button from '../components/ui/Button'

/**
 * P2P hub — Buy or Sell, then marketplace / express.
 */
export default function P2pHub() {
  const navigate = useNavigate()
  const { activeTransaction, hasActiveOrder } = useActiveTransaction()

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-rowan-text text-lg font-bold mb-2">P2P</h1>
      <p className="text-rowan-muted text-sm mb-6">
        Trade USDC with verified partners using mobile money.
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

      <div className="grid grid-cols-1 gap-3">
        <button
          type="button"
          disabled={hasActiveOrder}
          onClick={() => navigate('/wallet/marketplace', { state: { tab: 'buy' } })}
          className="bg-rowan-surface border border-rowan-border rounded-xl p-5 text-left min-h-11 disabled:opacity-50"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-rowan-yellow/15 flex items-center justify-center shrink-0">
              <ArrowDownToLine size={22} className="text-rowan-yellow" />
            </div>
            <div>
              <p className="text-rowan-text text-base font-semibold">Buy</p>
              <p className="text-rowan-muted text-xs mt-1 leading-relaxed">
                Pay mobile money · receive USDC from a trader you choose
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={hasActiveOrder}
          onClick={() => navigate('/wallet/marketplace', { state: { tab: 'sell' } })}
          className="bg-rowan-surface border border-rowan-border rounded-xl p-5 text-left min-h-11 disabled:opacity-50"
        >
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-full bg-rowan-yellow/15 flex items-center justify-center shrink-0">
              <ArrowUpFromLine size={22} className="text-rowan-yellow" />
            </div>
            <div>
              <p className="text-rowan-text text-base font-semibold">Sell</p>
              <p className="text-rowan-muted text-xs mt-1 leading-relaxed">
                Send USDC · get mobile money from a trader you choose
              </p>
            </div>
          </div>
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
