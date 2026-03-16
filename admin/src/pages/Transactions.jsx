import { useState, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import TransactionFilters from '../components/transactions/TransactionFilters'
import TransactionRow from '../components/transactions/TransactionRow'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { ArrowLeftRight } from 'lucide-react'
import useTransactions from '../hooks/useTransactions'

export default function Transactions() {
  const [filters, setFilters] = useState({})
  const { data, loading, error, pages, page, setPage, refresh } = useTransactions(filters)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const transactions = data || []
  const totalPages = pages || 1

  return (
    <>
      <TopBar title="Transactions" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <TransactionFilters filters={filters} onChange={setFilters} />

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load transactions.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size={24} />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No transactions found" description="Adjust filters to see results" />
        ) : (
          <>
            <div className="bg-rowan-surface rounded-xl border border-rowan-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium">Currency</th>
                    <th className="text-left px-4 py-3 font-medium">State</th>
                    <th className="text-left px-4 py-3 font-medium">Trader</th>
                    <th className="text-left px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </>
  )
}
