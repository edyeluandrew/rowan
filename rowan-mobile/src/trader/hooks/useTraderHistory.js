import { useState, useEffect, useCallback } from 'react';
import { getHistory, getStats } from '../api/trader';

function normalizeTransactions(data) {
  if (Array.isArray(data)) return data.filter(Boolean);
  if (Array.isArray(data?.transactions)) return data.transactions.filter(Boolean);
  if (Array.isArray(data?.data?.transactions)) return data.data.transactions.filter(Boolean);
  if (Array.isArray(data?.recentTransactions)) return data.recentTransactions.filter(Boolean);
  return [];
}

function normalizeStats(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.stats && typeof data.stats === 'object') return data.stats;
  return data;
}

/**
 * useTraderHistory — paginated trader transaction history + header stats.
 */
export function useTraderHistory(limit = 20) {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(normalizeStats(data));
    } catch {
      /* stats header is optional */
    }
  }, []);

  const fetchPage = useCallback(async (p, { append = p > 1 } = {}) => {
    try {
      const data = await getHistory(p, limit);
      const list = normalizeTransactions(data);
      setTransactions((prev) => (append ? [...prev, ...list] : list));
      setHasMore(list.length >= limit);
      setError(null);
      return list;
    } catch (err) {
      if (p === 1) {
        setError(err.message || 'Failed to load history');
        setTransactions([]);
      }
      return [];
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limit]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setPage(1);
    await Promise.all([fetchStats(), fetchPage(1, { append: false })]);
  }, [fetchStats, fetchPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    await fetchPage(next, { append: true });
  }, [page, fetchPage]);

  return {
    transactions,
    stats,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  };
}
