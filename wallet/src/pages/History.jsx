import { useState } from 'react'
import { Search, SlidersHorizontal, X, Clock, AlertTriangle } from 'lucide-react'
import useTransactions from '../hooks/useTransactions'
import TransactionCard from '../components/transactions/TransactionCard'
import BottomSheet from '../components/ui/BottomSheet'
import Badge from '../components/ui/Badge'
import { TX_STATES } from '../utils/constants'
import { formatXlm } from '../utils/format'

const FILTER_OPTIONS = ['ALL', 'COMPLETE', 'FIAT_SENT', 'REFUNDED', 'FAILED']

export default function History() {
  const { transactions, stats, loading, error, hasMore, loadMore, refresh } = useTransactions()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = transactions.filter((tx) => {
    const matchesFilter = filter === 'ALL' || tx.state === filter
    const matchesSearch =
      !search ||
      tx.id?.toLowerCase().includes(search.toLowerCase()) ||
      tx.network?.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-rowan-text text-lg font-bold mb-4">History</h1>

      {stats && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <div className="bg-rowan-surface rounded-lg px-3 py-2 shrink-0">
            <p className="text-rowan-muted text-[10px]">Total</p>
            <p className="text-rowan-text text-sm font-semibold">{stats.total || 0}</p>
          </div>
          <div className="bg-rowan-surface rounded-lg px-3 py-2 shrink-0">
            <p className="text-rowan-muted text-[10px]">Volume</p>
            <p className="text-rowan-text text-sm font-semibold">
              {formatXlm(stats.totalXlm || 0)}
            </p>
          </div>
          <div className="bg-rowan-surface rounded-lg px-3 py-2 shrink-0">
            <p className="text-rowan-muted text-[10px]">Completed</p>
            <p className="text-rowan-green text-sm font-semibold">{stats.completed || 0}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-rowan-muted" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-rowan-surface border border-rowan-border rounded-xl pl-9 pr-4 py-3 text-rowan-text text-sm placeholder:text-rowan-muted focus:outline-none focus:border-rowan-yellow min-h-11"
          />
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="bg-rowan-surface border border-rowan-border rounded-xl px-3 min-h-11 flex items-center justify-center"
        >
          <SlidersHorizontal size={18} className="text-rowan-muted" />
        </button>
      </div>

      {filter !== 'ALL' && (
        <div className="flex items-center gap-2 mb-4">
          <Badge color="yellow">{TX_STATES[filter]?.label || filter}</Badge>
          <button onClick={() => setFilter('ALL')}>
            <X size={14} className="text-rowan-muted" />
          </button>
        </div>
      )}

      {loading && transactions.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin text-rowan-muted">
            <Clock size={20} />
          </div>
        </div>
      ) : error && transactions.length === 0 ? (
        <div className="bg-rowan-surface rounded-xl p-8 text-center">
          <AlertTriangle size={32} className="text-rowan-red mx-auto mb-3" />
          <p className="text-rowan-text text-sm font-medium mb-1">Failed to load transactions</p>
          <p className="text-rowan-muted text-xs mb-3">{error}</p>
          <button onClick={refresh} className="text-rowan-yellow text-sm font-medium underline min-h-9">
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-rowan-surface rounded-xl p-8 text-center">
          <Clock size={32} className="text-rowan-muted mx-auto mb-3" />
          <p className="text-rowan-muted text-sm">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tx) => (
            <TransactionCard key={tx.id} transaction={tx} />
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full text-rowan-yellow text-sm py-3 min-h-11"
            >
              Load More
            </button>
          )}
        </div>
      )}

      <BottomSheet open={showFilters} onClose={() => setShowFilters(false)} title="Filter by Status">
        <div className="space-y-2 p-4">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => { setFilter(opt); setShowFilters(false) }}
              className={`w-full text-left px-4 py-3 rounded-xl min-h-11 transition-colors ${
                filter === opt
                  ? 'bg-rowan-yellow/10 text-rowan-yellow border border-rowan-yellow/30'
                  : 'bg-rowan-surface text-rowan-text'
              }`}
            >
              {opt === 'ALL' ? 'All Transactions' : TX_STATES[opt]?.label || opt}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
