import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, SlidersHorizontal, CircleAlert, Signal,
  CalendarDays, DollarSign, SearchX, ShieldAlert,
} from 'lucide-react';
import { getHistory, getStats } from '../api/trader';
import { formatCurrency } from '../utils/format';
import TransactionCard from '../components/cards/TransactionCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STATUS_OPTIONS = ['COMPLETED', 'FIAT_SENT', 'TRADER_MATCHED', 'EXPIRED', 'DISPUTED', 'REFUNDED'];
const NETWORK_OPTIONS = ['MTN', 'AIRTEL', 'BANK'];
const DATE_OPTIONS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export default function History() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const limit = 20;

  /* Search & Filter state */
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ statuses: [], networks: [], dateDays: null, minAmount: '', maxAmount: '' });

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch { /* non-critical — stats card gracefully shows defaults */ }
  }, []);

  const fetchPage = useCallback(async (p) => {
    try {
      const data = await getHistory(p, limit);
      const list = Array.isArray(data) ? data : data.transactions || [];
      if (p === 1) {
        setTransactions(list);
      } else {
        setTransactions((prev) => [...prev, ...list]);
      }
      setHasMore(list.length === limit);
    } catch { /* pagination silently retries on next tap */ } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPage(1);
  }, [fetchStats, fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    fetchPage(next);
  };

  /* Active filter count */
  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.statuses.length) c++;
    if (filters.networks.length) c++;
    if (filters.dateDays !== null) c++;
    if (filters.minAmount || filters.maxAmount) c++;
    return c;
  }, [filters]);

  /* Client-side filter + search */
  const filtered = useMemo(() => {
    let list = transactions;

    // Text search
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (tx) =>
          (tx.reference || tx.id || '').toLowerCase().includes(q) ||
          (tx.network || '').toLowerCase().includes(q) ||
          (tx.state || '').toLowerCase().includes(q) ||
          (tx.recipient_phone_last4 || '').includes(q) ||
          String(tx.fiat_amount || '').includes(q),
      );
    }

    // Status
    if (filters.statuses.length) {
      list = list.filter((tx) => filters.statuses.includes(tx.state));
    }

    // Network
    if (filters.networks.length) {
      list = list.filter((tx) => filters.networks.includes(tx.network));
    }

    // Date
    if (filters.dateDays !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.dateDays);
      cutoff.setHours(0, 0, 0, 0);
      list = list.filter((tx) => new Date(tx.created_at) >= cutoff);
    }

    // Amount range
    if (filters.minAmount) {
      const min = Number(filters.minAmount);
      list = list.filter((tx) => (tx.fiat_amount || 0) >= min);
    }
    if (filters.maxAmount) {
      const max = Number(filters.maxAmount);
      list = list.filter((tx) => (tx.fiat_amount || 0) <= max);
    }

    return list;
  }, [transactions, query, filters]);

  const toggleArrayFilter = (key, value) => {
    setFilters((prev) => {
      const arr = prev[key];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const clearFilters = () => {
    setFilters({ statuses: [], networks: [], dateDays: null, minAmount: '', maxAmount: '' });
  };

  /* Filter pills */
  const pills = useMemo(() => {
    const p = [];
    filters.statuses.forEach((s) => p.push({ key: `status-${s}`, label: s.replace(/_/g, ' '), remove: () => toggleArrayFilter('statuses', s) }));
    filters.networks.forEach((n) => p.push({ key: `net-${n}`, label: n, remove: () => toggleArrayFilter('networks', n) }));
    if (filters.dateDays !== null) {
      const opt = DATE_OPTIONS.find((d) => d.days === filters.dateDays);
      p.push({ key: 'date', label: opt?.label || `${filters.dateDays}d`, remove: () => setFilters((f) => ({ ...f, dateDays: null })) });
    }
    if (filters.minAmount || filters.maxAmount) {
      const label = filters.minAmount && filters.maxAmount
        ? `${filters.minAmount}–${filters.maxAmount}`
        : filters.minAmount ? `≥${filters.minAmount}` : `≤${filters.maxAmount}`;
      p.push({ key: 'amount', label, remove: () => setFilters((f) => ({ ...f, minAmount: '', maxAmount: '' })) });
    }
    return p;
  }, [filters]);

  return (
    <div className="bg-rowan-bg min-h-screen px-4 pt-4 pb-24">
      <h1 className="text-rowan-text font-semibold text-lg mb-4">History</h1>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 bg-rowan-surface border border-rowan-border rounded-lg px-3 py-2">
          <Search size={16} className="text-rowan-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ref, network, amount…"
            className="flex-1 bg-transparent text-rowan-text text-sm placeholder-rowan-muted outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-rowan-muted">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className={`relative p-2.5 rounded-lg border transition-colors ${
            activeFilterCount > 0
              ? 'bg-rowan-yellow/10 border-rowan-yellow text-rowan-yellow'
              : 'bg-rowan-surface border-rowan-border text-rowan-muted'
          }`}
        >
          <SlidersHorizontal size={18} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-rowan-yellow text-rowan-bg text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active filter pills */}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1 bg-rowan-yellow/10 text-rowan-yellow text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {pill.label}
              <button onClick={pill.remove}><X size={12} /></button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-rowan-muted text-xs underline">Clear all</button>
        </div>
      )}

      {/* Header stats */}
      {stats && (
        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar">
          <div className="bg-rowan-surface rounded-xl px-4 py-2 shrink-0">
            <span className="text-rowan-muted text-[10px] uppercase tracking-wider">Completed</span>
            <p className="text-rowan-green text-base font-bold">{stats.completed_count ?? '—'}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl px-4 py-2 shrink-0">
            <span className="text-rowan-muted text-[10px] uppercase tracking-wider">Volume</span>
            <p className="text-rowan-text text-base font-bold">
              {stats.total_volume_ugx
                ? formatCurrency(stats.total_volume_ugx, 'UGX')
                : '—'}
            </p>
          </div>
          <div className="bg-rowan-surface rounded-xl px-4 py-2 shrink-0">
            <span className="text-rowan-muted text-[10px] uppercase tracking-wider">Earnings</span>
            <p className="text-rowan-yellow text-base font-bold">
              {stats.total_earnings_ugx
                ? formatCurrency(stats.total_earnings_ugx, 'UGX')
                : '—'}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={28} className="text-rowan-yellow" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <SearchX size={48} className="text-rowan-muted mb-4" />
          <span className="text-rowan-muted text-sm">
            {query || activeFilterCount > 0 ? 'No matching transactions' : 'No transactions yet'}
          </span>
          {(query || activeFilterCount > 0) && (
            <button
              onClick={() => { setQuery(''); clearFilters(); }}
              className="text-rowan-yellow text-sm mt-2 underline"
            >
              Clear search &amp; filters
            </button>
          )}
        </div>
      ) : (
        <div>
          {filtered.map((tx) => (
            <div key={tx.id}>
              <TransactionCard key={tx.id} transaction={tx} />
              {/* Disputed — prompt to respond */}
              {tx.state === 'DISPUTED' && tx.dispute_id && (
                <button
                  onClick={() => navigate(`/trader/disputes/${tx.dispute_id}`)}
                  className="flex items-center gap-1.5 text-rowan-red text-xs font-medium px-4 -mt-1 mb-2"
                >
                  <ShieldAlert size={14} /> Respond to Dispute
                </button>
              )}
            </div>
          ))}

          {hasMore && !query && activeFilterCount === 0 && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 mt-2 text-sm text-rowan-yellow font-medium rounded-xl bg-rowan-surface active:bg-rowan-border transition-colors flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <LoadingSpinner size={16} className="text-rowan-yellow" />
              ) : (
                'Load More'
              )}
            </button>
          )}
        </div>
      )}

      {/* Filter Bottom Sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowFilters(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto animate-slide-down"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-rowan-text font-semibold text-base">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-rowan-muted">
                <X size={20} />
              </button>
            </div>

            {/* Status */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CircleAlert size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Status</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleArrayFilter('statuses', s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.statuses.includes(s)
                        ? 'bg-rowan-yellow text-rowan-bg'
                        : 'bg-rowan-border text-rowan-muted'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Network */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Signal size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Network</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {NETWORK_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleArrayFilter('networks', n)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.networks.includes(n)
                        ? 'bg-rowan-yellow text-rowan-bg'
                        : 'bg-rowan-border text-rowan-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Date Range</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DATE_OPTIONS.map((d) => (
                  <button
                    key={d.days}
                    onClick={() =>
                      setFilters((f) => ({ ...f, dateDays: f.dateDays === d.days ? null : d.days }))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.dateDays === d.days
                        ? 'bg-rowan-yellow text-rowan-bg'
                        : 'bg-rowan-border text-rowan-muted'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Range */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Amount (UGX)</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={filters.minAmount}
                  onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
                  placeholder="Min"
                  className="flex-1 bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-sm placeholder-rowan-muted outline-none"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
                  placeholder="Max"
                  className="flex-1 bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-sm placeholder-rowan-muted outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { clearFilters(); setShowFilters(false); }}
                className="flex-1 py-3 rounded-xl bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Reset
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 py-3 rounded-xl bg-rowan-yellow text-rowan-bg text-sm font-medium"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
