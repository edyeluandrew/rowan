import { useState, useEffect, useCallback } from 'react';
import { getDisputes } from '../api/disputes';
import { useSocket } from '../context/SocketContext';

/**
 * useDisputes — fetch and sync disputes list with socket updates.
 */
export function useDisputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { on, off } = useSocket();

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDisputes();
      setDisputes(Array.isArray(data) ? data : data.disputes || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  /* ── Socket updates ── */
  useEffect(() => {
    const handleNewDispute = (dispute) => {
      setDisputes((prev) => [dispute, ...prev]);
    };

    const handleDisputeUpdate = (data) => {
      const id = data?.id || data?.dispute_id;
      setDisputes((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...data } : d))
      );
    };

    on('new_dispute', handleNewDispute);
    on('dispute_update', handleDisputeUpdate);

    return () => {
      off('new_dispute', handleNewDispute);
      off('dispute_update', handleDisputeUpdate);
    };
  }, [on, off]);

  return { disputes, loading, error, refresh: fetch };
}
