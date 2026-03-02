import { useState, useEffect, useCallback } from 'react';
import { getProfile, getStats } from '../api/trader';

/**
 * useTrader — fetch and cache trader profile + daily stats.
 */
export function useTrader() {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data.trader || data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await getStats();
      setStats(data.stats || data);
    } catch (err) {
      setError(err);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchProfile(), fetchStats()]);
  }, [fetchProfile, fetchStats]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();

    /* Auto-refresh stats every 60 s */
    const id = setInterval(fetchStats, 60_000);
    return () => clearInterval(id);
  }, [refresh, fetchStats]);

  return { profile, stats, loading, error, refresh, fetchStats };
}
