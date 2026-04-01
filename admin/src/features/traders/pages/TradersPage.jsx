import { useState, useCallback } from 'react'
import TopBar from '../../../shared/components/layout/TopBar'
import TraderRow from '../components/TraderRow'
import Pagination from '../../../shared/components/ui/Pagination'
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner'
import EmptyState from '../../../shared/components/ui/EmptyState'
import { Users } from 'lucide-react'
import useTraders from '../hooks/useTraders'

const TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
]

export default function TradersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const filters = { status: statusFilter || undefined, search: search || undefined }
  const { data, loading, error, total, page, setPage, refresh } = useTraders(filters)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }, [refresh])

  const traders = data || []
  const totalPages = Math.max(1, Math.ceil((total || 0) / 25))

  return (
    <>
      <TopBar title="Traders" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 bg-rowan-surface rounded-xl p-1 border border-rowan-border">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setStatusFilter(tab.value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-rowan-yellow/10 text-rowan-yellow font-medium'
                    : 'text-rowan-muted hover:text-rowan-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search traders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow w-48"
          />
        </div>

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load traders.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : traders.length === 0 ? (
          <EmptyState icon={Users} title="No traders found" description="Adjust filters to see results" />
        ) : (
          <>
            <div className="bg-rowan-surface rounded-xl border border-rowan-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Volume</th>
                    <th className="text-left px-4 py-3 font-medium">Trust</th>
                    <th className="text-left px-4 py-3 font-medium">Float</th>
                  </tr>
                </thead>
                <tbody>
                  {traders.map((trader) => (
                    <TraderRow key={trader.id} trader={trader} />
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
