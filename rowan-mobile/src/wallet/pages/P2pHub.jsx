import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Zap } from 'lucide-react'
import useActiveTransaction from '../hooks/useActiveTransaction'
import Button from '../components/ui/Button'

/**
 * P2P hub — Buy / Sell segmented control (same style as balance unit toggle).
 */
export default function P2pHub() {
  const navigate = useNavigate()
  const { activeTransaction, hasActiveOrder } = useActiveTransaction()
  const [mode, setMode] = useState('buy') // 'buy' | 'sell'

  const goTrade = (nextMode) => {
    setMode(nextMode)
    if (hasActiveOrder) return
    navigate('/wallet/marketplace', { state: { tab: nextMode } })
  }

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

      <div className="bg-rowan-surface border border-rowan-border rounded-2xl p-5">
        <p className="text-rowan-muted text-xs uppercase tracking-wider mb-3">Trade</p>

        <div className="inline-flex w-full bg-rowan-bg border border-rowan-border rounded-xl p-1">
          <button
            type="button"
            disabled={hasActiveOrder}
            onClick={() => goTrade('buy')}
            className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold min-h-11 disabled:opacity-50 ${
              mode === 'buy' ? 'bg-rowan-yellow text-rowan-bg' : 'text-rowan-muted'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            disabled={hasActiveOrder}
            onClick={() => goTrade('sell')}
            className={`flex-1 px-3 py-3 rounded-lg text-sm font-semibold min-h-11 disabled:opacity-50 ${
              mode === 'sell' ? 'bg-rowan-yellow text-rowan-bg' : 'text-rowan-muted'
            }`}
          >
            Sell
          </button>
        </div>

        <p className="text-rowan-muted text-xs mt-3 leading-relaxed">
          {mode === 'buy'
            ? 'Pay mobile money · receive USDC'
            : 'Send USDC · get mobile money'}
        </p>
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
