import { useEffect } from 'react'
import { useSocketContext } from '../context/SocketContext'

/** Join the order chat/status room while viewing a transaction. */
export default function useJoinOrder(transactionId) {
  const { joinOrder } = useSocketContext()

  useEffect(() => {
    if (!transactionId || !joinOrder) return
    joinOrder(transactionId)
  }, [transactionId, joinOrder])
}
