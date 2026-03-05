import { useState, useCallback } from 'react'
import TopBar from '../components/layout/TopBar'
import DisputeRow from '../components/disputes/DisputeRow'
import Pagination from '../components/ui/Pagination'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { Flag } from 'lucide-react'
import useDisputes from '../hooks/useDisputes'

const TABS = [
  { value: '', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export default function Disputes() {
  const [priorityFilter, setPriorityFilter] = useState('')
  const [search, setSearch] = useState('')
  const filters = { priority: priorityFilter || undefined, search: search || undefined }
  const { data, loading, error, page, setPage, refetch } = useDisputes(filters)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const disputes = data?.disputes || []
  const totalPages = data?.total_pages || 1

  return (
    <>
      <TopBar title="Disputes" onRefresh={handleRefresh} refreshing={refreshing} />
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 bg-rowan-surface rounded-xl p-1 border border-rowan-border">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => { setPriorityFilter(tab.value); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  priorityFilter === tab.value
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
            placeholder="Search disputes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-rowan-surface border border-rowan-border text-rowan-text rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-rowan-yellow w-48"
          />
        </div>

        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 text-rowan-red rounded-xl px-4 py-3 text-sm">
            Failed to load disputes.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16"><LoadingSpinner size={24} /></div>
        ) : disputes.length === 0 ? (
          <EmptyState icon={Flag} title="No disputes found" description="Adjust filters to see results" />
        ) : (
          <>
            <div className="bg-rowan-surface rounded-xl border border-rowan-border overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-rowan-border text-rowan-muted text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Reason</th>
                    <th className="text-left px-4 py-3 font-medium">Priority</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((dispute) => (
                    <DisputeRow key={dispute.id} dispute={dispute} />
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
