import { useState, useEffect, useCallback, useRef } from 'react';
import { getFloatHealth } from '../api/sla';

/**
 * useFloatHealth — fetch float health on mount and every 5 minutes.
 */
export function useFloatHealth() {
  const [floatHealth, setFloatHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const data = await getFloatHealth();
      setFloatHealth(data);
    } catch { /* non-critical — banner simply hidden */ } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetch]);

  return { floatHealth, isLoading, refetch: fetch };
}
