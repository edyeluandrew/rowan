import { useState, useEffect, useCallback } from 'react';
import { getRequests } from '../api/trader';
import { useSocket } from '../context/SocketContext';

/**
 * useRequests — live pending + active request lists.
 */
export function useRequests() {
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState([]);
  const [loading, setLoading] = useState(true);
  const { on, off } = useSocket();

  const fetchPending = useCallback(async () => {
    try {
      const data = await getRequests('pending');
      // Handle both old format ({ requests }) and new format ({ success, data })
      setPending(data.data || data.requests || data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const data = await getRequests('active');
      // Handle both old format ({ requests }) and new format ({ success, data })
      setActive(data.data || data.requests || data || []);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchPending(), fetchActive()]);
  }, [fetchPending, fetchActive]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  /* ── WebSocket events ── */
  useEffect(() => {
    const handleNew = (req) => {
      setPending((prev) => {
        // Don't add duplicate IDs
        if (prev.some((r) => r.id === req.id)) {
          return prev;
        }
        return [req, ...prev];
      });
    };
    const handleTimeout = (data) => {
      const id = data?.id || data?.transactionId;
      setPending((prev) => prev.filter((r) => r.id !== id));
      setActive((prev) => prev.filter((r) => r.id !== id));
    };
    const handleDeclined = (data) => {
      const id = data?.id || data?.transactionId;
      setPending((prev) => prev.filter((r) => r.id !== id));
      setActive((prev) => prev.filter((r) => r.id !== id));
    };
    const handleUpdate = (data) => {
      const id = data?.id || data?.transactionId;
      // If request moves to FIAT_PAYOUT_SUBMITTED or later, remove from pending and add to active
      if (['FIAT_PAYOUT_SUBMITTED', 'USER_CONFIRMATION_PENDING', 'COMPLETE', 'DISPUTE_OPENED'].includes(data?.state)) {
        setPending((prev) => prev.filter((r) => r.id !== id));
        setActive((prev) => {
          // Don't add duplicate if it already exists in active
          if (prev.some((r) => r.id === id)) {
            return prev.map((r) => (r.id === id ? { ...r, ...data } : r));
          }
          return [{ ...data, id }, ...prev];
        });
      } else {
        // Update in active if it exists
        setActive((prev) => prev.map((r) => (r.id === id ? { ...r, ...data } : r)));
      }
    };

    on('new_request', handleNew);
    on('request_timeout', handleTimeout);
    on('request_declined_requeued', handleDeclined);
    on('transaction_update', handleUpdate);

    return () => {
      off('new_request', handleNew);
      off('request_timeout', handleTimeout);
      off('request_declined_requeued', handleDeclined);
      off('transaction_update', handleUpdate);
    };
  }, [on, off]);

  return { pending, active, loading, refresh, fetchPending, fetchActive, setPending };
}
