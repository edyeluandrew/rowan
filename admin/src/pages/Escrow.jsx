import { useState, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import EscrowBalanceCard from '../components/escrow/EscrowBalanceCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Lock, ExternalLink } from 'lucide-react'
import useEscrow from '../hooks/useEscrow'
import { formatXlm, formatDateTime, formatAddress } from '../utils/format'
import { STELLAR_EXPLORER_URL } from '../utils/constants'
import TransactionStateTag from '../components/transactions/TransactionStateTag'

export default function Escrow() {
  const { data, loading, error, refetch } = useEscrow()
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const status = data?.status || {}
  const transactions = data?.transactions || []

  const lockedTxs = transactions.filter((t) => t.type === 'lock' || t.locked)
  const refundTxs = transactions.filter((t) => t.type === 'refund' || t.pending_refund)

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
                    <th className="text-left px-4 py-2 font-medium">Stellar TX</th>
                  </tr>
                </thead>
                <tbody>
                  {lockedTxs.map((tx) => (
                    <tr key={tx.id} className="border-b border-rowan-border/50">
                      <td className="px-4 py-2 text-sm text-rowan-muted font-mono">{formatAddress(tx.id || tx.transaction_id)}</td>
                      <td className="px-4 py-2 text-sm text-rowan-text">{formatXlm(tx.amount)}</td>
                      <td className="px-4 py-2"><TransactionStateTag state={tx.state || 'locked'} /></td>
                      <td className="px-4 py-2 text-sm text-rowan-muted">{formatDateTime(tx.locked_at || tx.created_at)}</td>
                      <td className="px-4 py-2 text-sm">
                        {tx.stellar_tx_hash ? (
                          <a href={`${STELLAR_EXPLORER_URL}/transactions/${tx.stellar_tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-rowan-yellow hover:underline inline-flex items-center gap-1">
                            <span>{formatAddress(tx.stellar_tx_hash)}</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : '-'}
                      </td>
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
                      <td className="px-4 py-2 text-sm text-rowan-text">{formatXlm(tx.amount)}</td>
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
