import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, SlidersHorizontal, CircleAlert, Signal,
  CalendarDays, DollarSign, Clock, ShieldAlert, AlertTriangle,
} from 'lucide-react';
import { useTraderHistory } from '../hooks/useTraderHistory';
import { formatCurrency } from '../utils/format';
import TransactionCard from '../components/cards/TransactionCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const STATUS_OPTIONS = [
  'COMPLETE',
  'USER_CONFIRMATION_PENDING',
  'FIAT_PAYOUT_SUBMITTED',
  'TRADER_MATCHED',
  'DISPUTE_OPENED',
  'REFUNDED',
  'FAILED',
];
const NETWORK_OPTIONS = ['MTN_UG', 'AIRTEL_UG', 'MPESA_KE', 'MPESA_TZ'];
const DATE_OPTIONS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function txSearchText(tx) {
  return [
    tx?.reference,
    tx?.id,
    tx?.network,
    tx?.state,
    tx?.recipient_phone_last4,
    tx?.fiat_amount,
  ]
    .filter((part) => part != null && part !== '')
    .map(String)
    .join(' ')
    .toLowerCase();
}

export default function History() {
  const navigate = useNavigate();
  const {
    transactions,
    stats,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = useTraderHistory(20);

  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    statuses: [],
    networks: [],
    dateDays: null,
    minAmount: '',
    maxAmount: '',
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statuses.length) count += 1;
    if (filters.networks.length) count += 1;
    if (filters.dateDays !== null) count += 1;
    if (filters.minAmount || filters.maxAmount) count += 1;
    return count;
  }, [filters]);

  const filtered = useMemo(() => {
    let list = Array.isArray(transactions) ? transactions.filter(Boolean) : [];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((tx) => txSearchText(tx).includes(q));
    }

    if (filters.statuses.length) {
      list = list.filter((tx) => filters.statuses.includes(tx.state));
    }

    if (filters.networks.length) {
      list = list.filter((tx) => filters.networks.includes(tx.network));
    }

    if (filters.dateDays !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.dateDays);
      cutoff.setHours(0, 0, 0, 0);
      list = list.filter((tx) => {
        const created = new Date(tx.created_at || tx.completed_at || 0);
        return Number.isFinite(created.getTime()) && created >= cutoff;
      });
    }

    if (filters.minAmount) {
      const min = Number(filters.minAmount);
      list = list.filter((tx) => safeNumber(tx.fiat_amount) >= min);
    }

    if (filters.maxAmount) {
      const max = Number(filters.maxAmount);
      list = list.filter((tx) => safeNumber(tx.fiat_amount) <= max);
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

  const pills = useMemo(() => {
    const items = [];
    filters.statuses.forEach((status) => {
      items.push({
        key: `status-${status}`,
        label: status.replace(/_/g, ' '),
        remove: () => toggleArrayFilter('statuses', status),
      });
    });
    filters.networks.forEach((network) => {
      items.push({
        key: `net-${network}`,
        label: network.replace(/_/g, ' '),
        remove: () => toggleArrayFilter('networks', network),
      });
    });
    if (filters.dateDays !== null) {
      const option = DATE_OPTIONS.find((d) => d.days === filters.dateDays);
      items.push({
        key: 'date',
        label: option?.label || `${filters.dateDays}d`,
        remove: () => setFilters((f) => ({ ...f, dateDays: null })),
      });
    }
    if (filters.minAmount || filters.maxAmount) {
      const label = filters.minAmount && filters.maxAmount
        ? `${filters.minAmount}–${filters.maxAmount}`
        : filters.minAmount ? `≥${filters.minAmount}` : `≤${filters.maxAmount}`;
      items.push({
        key: 'amount',
        label,
        remove: () => setFilters((f) => ({ ...f, minAmount: '', maxAmount: '' })),
      });
    }
    return items;
  }, [filters]);

  const completedCount = stats?.completed_count ?? stats?.today?.tx_count ?? null;
  const totalVolume = stats?.total_volume_ugx ?? null;
  const totalEarnings = stats?.total_earnings_ugx ?? null;

  return (
    <div className="bg-rowan-bg min-h-screen px-4 pt-4 pb-24">
      <h1 className="text-rowan-text font-semibold text-lg mb-4">History</h1>

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
            <button type="button" onClick={() => setQuery('')} className="text-rowan-muted">
              <X size={16} />
            </button>
          )}
        </div>
        <button
          type="button"
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

      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {pills.map((pill) => (
            <span
              key={pill.key}
              className="inline-flex items-center gap-1 bg-rowan-yellow/10 text-rowan-yellow text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {pill.label}
              <button type="button" onClick={pill.remove}><X size={12} /></button>
            </span>
          ))}
          <button type="button" onClick={clearFilters} className="text-rowan-muted text-xs underline">
            Clear all
          </button>
        </div>
      )}

      {stats && (
        <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
          <div className="bg-rowan-surface rounded-xl px-4 py-2 shrink-0">
            <span className="text-rowan-muted text-[10px] uppercase tracking-wider">Completed</span>
            <p className="text-rowan-green text-base font-bold">{completedCount ?? '—'}</p>
          </div>
          <div className="bg-rowan-surface rounded-xl px-4 py-2 shrink-0">
            <span className="text-rowan-muted text-[10px] uppercase tracking-wider">Volume</span>
            <p className="text-rowan-text text-base font-bold">
              {totalVolume != null && totalVolume !== ''
                ? formatCurrency(totalVolume, 'UGX')
                : '—'}
            </p>
          </div>
          <div className="bg-rowan-surface rounded-xl px-4 py-2 shrink-0">
            <span className="text-rowan-muted text-[10px] uppercase tracking-wider">Earnings</span>
            <p className="text-rowan-yellow text-base font-bold">
              {totalEarnings != null && totalEarnings !== ''
                ? formatCurrency(totalEarnings, 'UGX')
                : '—'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rowan-red/10 border border-rowan-red/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="text-rowan-red shrink-0 mt-0.5" />
            <div>
              <p className="text-rowan-red text-sm">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="text-rowan-yellow text-sm mt-2 underline"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size={28} className="text-rowan-yellow" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Clock size={48} className="text-rowan-muted mb-4" />
          <span className="text-rowan-muted text-sm">
            {query || activeFilterCount > 0 ? 'No matching transactions' : 'No transactions yet'}
          </span>
          {(query || activeFilterCount > 0) && (
            <button
              type="button"
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
            <div key={tx.id || `${tx.created_at}-${tx.fiat_amount}`}>
              <TransactionCard tx={tx} />
              {(tx.state === 'DISPUTE_OPENED' || tx.state === 'DISPUTED') && tx.dispute_id && (
                <button
                  type="button"
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
              type="button"
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

      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowFilters(false)}>
          <div
            className="bg-rowan-surface w-full max-w-md rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-rowan-text font-semibold text-base">Filters</h3>
              <button type="button" onClick={() => setShowFilters(false)} className="text-rowan-muted">
                <X size={20} />
              </button>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CircleAlert size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Status</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleArrayFilter('statuses', status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.statuses.includes(status)
                        ? 'bg-rowan-yellow text-rowan-bg'
                        : 'bg-rowan-border text-rowan-muted'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Signal size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Network</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {NETWORK_OPTIONS.map((network) => (
                  <button
                    key={network}
                    type="button"
                    onClick={() => toggleArrayFilter('networks', network)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.networks.includes(network)
                        ? 'bg-rowan-yellow text-rowan-bg'
                        : 'bg-rowan-border text-rowan-muted'
                    }`}
                  >
                    {network.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} className="text-rowan-muted" />
                <span className="text-rowan-muted text-xs uppercase tracking-wider">Date Range</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DATE_OPTIONS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        dateDays: prev.dateDays === option.days ? null : option.days,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      filters.dateDays === option.days
                        ? 'bg-rowan-yellow text-rowan-bg'
                        : 'bg-rowan-border text-rowan-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

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
                  onChange={(e) => setFilters((prev) => ({ ...prev, minAmount: e.target.value }))}
                  placeholder="Min"
                  className="flex-1 bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-sm placeholder-rowan-muted outline-none"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxAmount: e.target.value }))}
                  placeholder="Max"
                  className="flex-1 bg-rowan-bg border border-rowan-border rounded-lg px-3 py-2 text-rowan-text text-sm placeholder-rowan-muted outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { clearFilters(); setShowFilters(false); }}
                className="flex-1 py-3 rounded-xl bg-rowan-border text-rowan-text text-sm font-medium"
              >
                Reset
              </button>
              <button
                type="button"
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
