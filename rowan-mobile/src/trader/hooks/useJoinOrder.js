import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/** Join the order chat/status room while viewing a transaction. */
export default function useJoinOrder(transactionId) {
  const { joinOrder } = useSocket();

  useEffect(() => {
    if (!transactionId || !joinOrder) return;
    joinOrder(transactionId);
  }, [transactionId, joinOrder]);
}
