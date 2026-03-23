import { useState, useEffect, useCallback } from 'react';
import { getOnboardingStatus } from '../api/onboarding';

/**
 * useOnboardingStatus — fetch and cache onboarding status.
 */
export function useOnboardingStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOnboardingStatus();
      setStatus(data.status || data);
      return data.status || data;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
