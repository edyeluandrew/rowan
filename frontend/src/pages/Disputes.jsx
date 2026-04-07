import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ShieldAlert, Search, X, SlidersHorizontal,
} from 'lucide-react';
import { useDisputes } from '../hooks/useDisputes';
import { useSocket } from '../context/SocketContext';
import DisputeStatusBadge from '../components/disputes/DisputeStatusBadge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatDate, formatCurrency, formatTimeAgo } from '../utils/format';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'RESOLVED_TRADER_WIN', label: 'You Won' },
  { value: 'RESOLVED_USER_WIN', label: 'User Won' },
];

export default function Disputes() {
  const navigate = useNavigate();
  const { disputes, loading, error, refresh } = useDisputes();
  const { isConnected } = useSocket();

  /* UI State */
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'

  /* Computed */
  const filtered = useMemo(() => {
    let result = disputes;

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Search filter (by id, transaction_id, reason)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) =>
        (d.id && d.id.toLowerCase().includes(q)) ||
        (d.transaction_id && d.transaction_id.toLowerCase().includes(q)) ||
        (d.reason && d.reason.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      const aTime = new Date(a.created_at || a.createdAt).getTime();
      const bTime = new Date(b.created_at || b.createdAt).getTime();
      return sortBy === 'newest' ? bTime - aTime : aTime - bTime;
    });

    return result;
  }, [disputes, statusFilter, searchQuery, sortBy]);

  /* Summary stats */
  const stats = useMemo(() => ({
    total: disputes.length,
    open: disputes.filter((d) => d.status === 'OPEN').length,
    underReview: disputes.filter((d) => d.status === 'UNDER_REVIEW').length,
    resolved: disputes.filter((d) =>
      d.status === 'RESOLVED_TRADER_WIN' || d.status === 'RESOLVED_USER_WIN'
    ).length,
  }), [disputes]);

  if (loading) {
    return (
      <div className="bg-rowan-bg min-h-screen flex items-center justify-center">
        <LoadingSpinner size={32} className="text-rowan-yellow" />
      </div>
    );
  }

  return (
    <div className="bg-rowan-bg min-h-screen pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-rowan-border">
        <button onClick={() => navigate(-1)} className="text-rowan-text">
          <ChevronLeft size={22} />
        </button>
        <ShieldAlert size={20} className="text-rowan-red" />
        <h1 className="text-rowan-text font-semibold text-lg flex-1">Disputes</h1>
      </div>

      <div className="px-4 pt-4">
        {/* Description */}
        <p className="text-rowan-muted text-xs mb-4">
          Track and respond to transaction disputes.
        </p>

        {/* Summary cards */}
        {stats.total > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-rowan-surface border border-rowan-border rounded-lg p-3 text-center">
              <p className="text-rowan-text font-bold text-lg">{stats.total}</p>
              <p className="text-rowan-muted text-xs">Total</p>
            </div>
            <div className="bg-rowan-surface border border-rowan-border rounded-lg p-3 text-center">
              <p className="text-rowan-red font-bold text-lg">{stats.open}</p>
              <p className="text-rowan-muted text-xs">Open</p>
            </div>
            <div className="bg-rowan-surface border border-rowan-border rounded-lg p-3 text-center">
              <p className="text-rowan-yellow font-bold text-lg">{stats.underReview}</p>
              <p className="text-rowan-muted text-xs">Review</p>
            </div>
            <div className="bg-rowan-surface border border-rowan-border rounded-lg p-3 text-center">
              <p className="text-rowan-green font-bold text-lg">{stats.resolved}</p>
              <p className="text-rowan-muted text-xs">Resolved</p>
            </div>
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative bg-rowan-surface rounded-lg border border-rowan-border">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-rowan-muted" />
            <input
              type="text"
              placeholder="Search by ID or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-rowan-text text-sm pl-9 pr-3 py-2.5 outline-none placeholder-rowan-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-rowan-muted hover:text-rowan-text"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 rounded-lg border border-rowan-border text-rowan-muted hover:text-rowan-yellow transition-colors flex items-center gap-1"
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-rowan-surface border border-rowan-border rounded-lg p-4 mb-4 space-y-4">
            <div>
              <p className="text-rowan-text text-sm font-medium mb-2">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      statusFilter === f.value
                        ? 'bg-rowan-yellow text-rowan-bg font-medium'
                        : 'bg-rowan-border text-rowan-muted hover:text-rowan-text'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-rowan-text text-sm font-medium mb-2">Sort</p>
              <div className="flex gap-2">
                {[
                  { value: 'newest', label: 'Newest First' },
                  { value: 'oldest', label: 'Oldest First' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortBy(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs transition-colors ${
                      sortBy === opt.value
                        ? 'bg-rowan-yellow text-rowan-bg font-medium'
                        : 'bg-rowan-border text-rowan-muted hover:text-rowan-text'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-lg p-4 mb-4">
            <p className="text-rowan-red text-sm">{error}</p>
            <button
              onClick={refresh}
              className="text-rowan-yellow text-xs mt-2 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Connection warning */}
        {!isConnected && (
          <div className="bg-rowan-yellow/10 border border-rowan-yellow/30 rounded-lg p-3 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-rowan-yellow rounded-full" />
            <p className="text-rowan-yellow text-xs">
              You're offline. New disputes may not appear.
            </p>
          </div>
        )}

        {/* Empty state */}
        {disputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ShieldAlert size={48} className="text-rowan-muted mb-4" />
            <p className="text-rowan-muted text-sm mb-1">No disputes</p>
            <p className="text-rowan-muted text-xs">
              You're all clear!
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ShieldAlert size={48} className="text-rowan-muted mb-4" />
            <p className="text-rowan-muted text-sm">No disputes match filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-rowan-yellow text-xs mt-3 underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((dispute) => (
              <DisputeCard
                key={dispute.id}
                dispute={dispute}
                onClick={() => navigate(`/disputes/${dispute.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DisputeCard — individual dispute row.
 */
function DisputeCard({ dispute, onClick }) {
  const d = dispute;
  const hasResponded = d.traderResponse || d.trader_response;

  return (
    <button
      onClick={onClick}
      className="w-full bg-rowan-surface border border-rowan-border rounded-lg p-4 text-left hover:border-rowan-yellow transition-colors active:bg-rowan-border"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* Dispute ID + Status */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-rowan-text font-mono text-xs truncate">
              {d.id ? d.id.slice(0, 12) + '...' : 'Dispute'}
            </span>
            <DisputeStatusBadge status={d.status} />
          </div>
          {/* Transaction ID */}
          {d.transaction_id && (
            <p className="text-rowan-muted text-xs mb-2">
              Transaction: <span className="text-rowan-text font-mono">{d.transaction_id.slice(0, 12)}</span>
            </p>
          )}
          {/* Reason */}
          {d.reason && (
            <p className="text-rowan-muted text-xs line-clamp-2">
              {d.reason}
            </p>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between text-xs">
        <div className="space-y-1">
          {/* Amount if available */}
          {d.amount && (
            <p className="text-rowan-yellow font-bold tabular-nums">
              {formatCurrency(d.amount, d.currency || 'UGX')}
            </p>
          )}
          {/* Dates */}
          <p className="text-rowan-muted">
            {formatTimeAgo(d.created_at || d.createdAt)}
          </p>
          {/* Response status */}
          {!hasResponded && d.status === 'OPEN' && (
            <p className="text-rowan-red font-medium">Awaiting your response</p>
          )}
          {hasResponded && d.status === 'UNDER_REVIEW' && (
            <p className="text-rowan-yellow font-medium">Response submitted</p>
          )}
        </div>
        {/* Arrow indicator */}
        <div className="text-rowan-muted">
          →
        </div>
      </div>
    </button>
  );
}
