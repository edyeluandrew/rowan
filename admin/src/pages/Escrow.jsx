import { useState, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import EscrowBalanceCard from '../components/escrow/EscrowBalanceCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Lock } from 'lucide-react'
import useEscrow from '../hooks/useEscrow'
import { formatUsdc, formatDateTime, formatAddress } from '../utils/format'
import TransactionStateTag from '../components/transactions/TransactionStateTag'

export default function Escrow() {
  const { status: escrowStatus, transactions: escrowTxs, loading, error, refresh } = useEscrow()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const status = escrowStatus || {}
  const transactions = escrowTxs || []

  const lockedTxs = transactions
  const refundTxs = []

  return (
    <>
      <TopBar title="Escrow" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load escrow data.
          </div>
        )}

        <EscrowBalanceCard status={status} loading={loading} />

        {/* Locked Transactions */}
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <h3 className="text-rowan-text font-bold mb-4">Locked Transactions</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={24} /></div>
          ) : lockedTxs.length === 0 ? (
            <EmptyState icon={Lock} title="No locked transactions" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">TX ID</th>
                    <th className="text-left px-4 py-2 font-medium">Amount</th>
                    <th className="text-left px-4 py-2 font-medium">State</th>
                    <th className="text-left px-4 py-2 font-medium">Locked At</th>
                    <th className="text-left px-4 py-2 font-medium">Trader</th>
                  </tr>
                </thead>
                <tbody>
                  {lockedTxs.map((tx) => (
                    <tr key={tx.id} className="border-b border-rowan-border/50">
                      <td className="px-4 py-2 text-sm text-rowan-muted font-mono">{formatAddress(tx.id)}</td>
                      <td className="px-4 py-2 text-sm text-rowan-text">{formatUsdc(tx.usdc_amount)} USDC</td>
                      <td className="px-4 py-2"><TransactionStateTag state={tx.state} /></td>
                      <td className="px-4 py-2 text-sm text-rowan-muted">{formatDateTime(tx.escrow_locked_at || tx.created_at)}</td>
                      <td className="px-4 py-2 text-sm text-rowan-muted">{tx.trader_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Refunds */}
        <div className="bg-rowan-surface rounded-xl border border-rowan-border p-4">
          <h3 className="text-rowan-text font-bold mb-4">Pending Refunds</h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><LoadingSpinner size={24} /></div>
          ) : refundTxs.length === 0 ? (
            <EmptyState icon={Lock} title="No pending refunds" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2 font-medium">TX ID</th>
                    <th className="text-left px-4 py-2 font-medium">Amount</th>
                    <th className="text-left px-4 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {refundTxs.map((tx) => (
                    <tr key={tx.id} className="border-b border-rowan-border/50">
                      <td className="px-4 py-2 text-sm text-rowan-muted font-mono">{formatAddress(tx.id || tx.transaction_id)}</td>
                      <td className="px-4 py-2 text-sm text-rowan-text">{formatUsdc(tx.usdc_amount || tx.amount)} USDC</td>
                      <td className="px-4 py-2 text-sm text-rowan-muted">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
