import { useState, useEffect, useCallback } from 'react';
import { getSessions, revokeSession, revokeAllSessions } from '../api/security';

/**
 * useSessions — manage session data for Active Sessions page.
 */
export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revoking, setRevoking] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSessions();
      setSessions(data.sessions || data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const revoke = useCallback(async (sessionId) => {
    setRevoking(true);
    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke session');
      return false;
    } finally {
      setRevoking(false);
    }
  }, []);

  const revokeAll = useCallback(async () => {
    setRevoking(true);
    try {
      await revokeAllSessions();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to revoke all sessions');
      return false;
    } finally {
      setRevoking(false);
    }
  }, []);

  return { sessions, loading, error, revoking, revoke, revokeAll, fetch };
}
