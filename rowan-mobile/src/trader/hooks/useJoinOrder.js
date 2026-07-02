import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/** Join the order chat/status room while viewing a transaction. */
export default function useJoinOrder(transactionId) {
  const { joinOrder, on, off } = useSocket();

  useEffect(() => {
    if (!transactionId || !joinOrder) return undefined;
    const rejoin = () => joinOrder(transactionId);
    rejoin();
    if (on) on('connect', rejoin);
    return () => { if (off) off('connect', rejoin); };
  }, [transactionId, joinOrder, on, off]);
}
