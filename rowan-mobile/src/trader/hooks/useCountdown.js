import { useState, useEffect, useRef } from 'react';

/**
 * useCountdown — countdown hook for timers.
 * @param {{ endTime?: string, seconds?: number }} opts
 * @returns {{ timeLeft: number, isExpired: boolean, formattedTime: string }}
 */
export function useCountdown({ endTime, seconds } = {}) {
  const calcRemaining = () => {
    if (endTime) return Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
    return 0;
  };

  const [timeLeft, setTimeLeft] = useState(() => (seconds != null ? seconds : calcRemaining()));
  const intervalRef = useRef(null);

  useEffect(() => {
    if (endTime) setTimeLeft(calcRemaining());
    else if (seconds != null) setTimeLeft(seconds);
  }, [endTime, seconds]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (endTime) {
          const rem = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
          if (rem <= 0) { clearInterval(intervalRef.current); return 0; }
          return rem;
        }
        const next = prev - 1;
        if (next <= 0) clearInterval(intervalRef.current);
        return Math.max(0, next);
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [endTime, timeLeft > 0]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');

  return {
    timeLeft,
    isExpired: timeLeft <= 0,
    formattedTime: `${mins}:${secs}`,
  };
}
