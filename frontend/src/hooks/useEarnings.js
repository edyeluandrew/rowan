import { useState, useCallback } from 'react';
import { getEarnings, getEarningsTransactions } from '../api/earnings';

/**
 * useEarnings — fetch earnings summary + recent txs for a given period.
 */
export function useEarnings(initialPeriod = '30d') {
  const [period, setPeriod] = useState(initialPeriod);
  const [earnings, setEarnings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async (p) => {
    setIsLoading(true);
    try {
      const [earningsData, txsData] = await Promise.all([
        getEarnings(p),
        getEarningsTransactions(p, 1, 10),
      ]);
      setEarnings(earningsData);
      setTransactions(txsData.transactions || txsData || []);
    } catch { /* fetch failed — previous data preserved */ } finally {
      setIsLoading(false);
    }
  }, []);

  const changePeriod = useCallback((p) => {
    setPeriod(p);
    fetch(p);
  }, [fetch]);

  return { period, earnings, transactions, isLoading, changePeriod, fetch };
}
