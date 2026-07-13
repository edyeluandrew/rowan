import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import useP2pHistory from '../hooks/useP2pHistory'
import P2pHistoryCard from '../components/history/P2pHistoryCard'
import HistorySkeleton from '../components/history/HistorySkeleton'
import Button from '../components/ui/Button'

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'disputed', label: 'Disputed' },
]

const RANGE_FILTERS = [
  { id: 'all', label: 'All time' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

const VALID_STATUS = new Set(STATUS_FILTERS.map((f) => f.id))

export default function History() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialStatus = VALID_STATUS.has(location.state?.status) ? location.state.status : 'all'
  const {
    transactions,
    loading,
    loadingMore,
    error,
    filters,
    hasMore,
    loadMore,
    refresh,
    updateFilters,
  } = useP2pHistory({ status: initialStatus, range: 'all' })
  const [filtersOpen, setFiltersOpen] = useState(initialStatus !== 'all')

  const setStatus = (status) => updateFilters({ ...filters, status })
  const setRange = (range) => updateFilters({ ...filters, range })

  return (
    <div className="bg-rowan-bg min-h-screen pb-24 px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-rowan-text text-lg font-bold">Transaction History</h1>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="text-rowan-muted min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Toggle filters"
        >
          <SlidersHorizontal size={20} />
        </button>
      </div>

      {filtersOpen && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-4 mb-4 space-y-4">
          <div>
            <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatus(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-9 ${
                    (filters.status || 'all') === f.id
                      ? 'bg-rowan-yellow text-rowan-bg'
                      : 'bg-rowan-bg text-rowan-muted border border-rowan-border'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-rowan-muted text-xs uppercase tracking-wider mb-2">Date range</p>
            <div className="flex flex-wrap gap-2">
              {RANGE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRange(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-9 ${
                    (filters.range || 'all') === f.id
                      ? 'bg-rowan-yellow text-rowan-bg'
                      : 'bg-rowan-bg text-rowan-muted border border-rowan-border'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="flex items-center gap-1 text-rowan-muted text-xs"
          >
            <ChevronUp size={14} />
            Hide filters
          </button>
        </div>
      )}

      {!filtersOpen && (filters.status !== 'all' || filters.range !== 'all') && (
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex items-center gap-1 text-rowan-yellow text-xs mb-4 min-h-9"
        >
          <ChevronDown size={14} />
          Filters active
        </button>
      )}

      {loading && transactions.length === 0 && <HistorySkeleton />}

      {error && transactions.length === 0 && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-6 text-center">
          <p className="text-rowan-red text-sm">{error}</p>
          <button type="button" onClick={refresh} className="text-rowan-yellow text-sm mt-3 underline">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && transactions.length === 0 && (
        <div className="bg-rowan-surface border border-rowan-border rounded-xl p-8 text-center">
          <p className="text-rowan-text text-sm font-medium">No transactions yet</p>
          <p className="text-rowan-muted text-xs mt-2">
            Start your first trade to see your history here
          </p>
          <Button className="mt-4" onClick={() => navigate('/wallet/p2p')}>
            Go to Marketplace
          </Button>
        </div>
      )}

      {transactions.length > 0 && (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <P2pHistoryCard key={tx.id} transaction={tx} />
          ))}
          {hasMore && (
            <Button
              variant="ghost"
              className="w-full mt-2"
              loading={loadingMore}
              onClick={loadMore}
            >
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
