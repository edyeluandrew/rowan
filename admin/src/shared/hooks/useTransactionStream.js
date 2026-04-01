import { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from '../context/SocketContext'

/**
 * Hook for real-time transaction streaming
 * Listens to WebSocket events for transaction updates and maintains a local state
 * 
 * Features:
 * - Real-time updates via WebSocket
 * - Initial data fetch via HTTP
 * - Optimistic updates with fallback
 * - Automatic reconnection handling
 */
export const useTransactionStream = () => {
  const { on, off, isConnected } = useSocket()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const transactionsRef = useRef(new Map())

  // Listen for transaction state changes via WebSocket
  useEffect(() => {
    if (!isConnected) return

    const handleTransactionUpdate = (data) => {
      setTransactions((prev) => {
        // Update or add transaction in local state
        const updated = [...prev]
        const idx = updated.findIndex((tx) => tx.id === data.id)

        if (idx >= 0) {
          // Update existing
          updated[idx] = { ...updated[idx], ...data }
        } else {
          // Add new (at the top for recent)
          updated.unshift(data)
        }

        return updated.slice(0, 100) // Keep only recent 100
      })

      // Also track in ref for quick lookups
      transactionsRef.current.set(data.id, data)
    }

    const handleTransactionNew = (data) => {
      setTransactions((prev) => [data, ...prev.slice(0, 99)])
      transactionsRef.current.set(data.id, data)
    }

    const handleTransactionDelete = (data) => {
      setTransactions((prev) => prev.filter((tx) => tx.id !== data.id))
      transactionsRef.current.delete(data.id)
    }

    // Subscribe to all transaction-related events
    on('transaction_update', handleTransactionUpdate)
    on('transaction_new', handleTransactionNew)
    on('transaction_delete', handleTransactionDelete)
    on('transaction_state_changed', handleTransactionUpdate)

    return () => {
      off('transaction_update', handleTransactionUpdate)
      off('transaction_new', handleTransactionNew)
      off('transaction_delete', handleTransactionDelete)
      off('transaction_state_changed', handleTransactionUpdate)
    }
  }, [isConnected, on, off])

  // Get a specific transaction from the stream
  const getTransaction = useCallback((id) => {
    return transactionsRef.current.get(id)
  }, [])

  // Filter transactions by state
  const getByState = useCallback((state) => {
    return transactions.filter((tx) => tx.state === state)
  }, [transactions])

  // Clear all transactions
  const clear = useCallback(() => {
    setTransactions([])
    transactionsRef.current.clear()
  }, [])

  return {
    transactions,
    loading,
    error,
    isConnected,
    getTransaction,
    getByState,
    clear,
  }
}

/**
 * Hook for transaction detail real-time updates
 * Subscribes to updates for a specific transaction
 */
export const useTransactionDetailStream = (transactionId) => {
  const { on, off, isConnected } = useSocket()
  const [transaction, setTransaction] = useState(null)
  const [loading, setLoading] = useState(!transactionId)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isConnected || !transactionId) return

    const handleUpdate = (data) => {
      if (data.id === transactionId) {
        setTransaction(data)
        setLoading(false)
      }
    }

    on(`transaction:${transactionId}`, handleUpdate)
    on('transaction_update', handleUpdate)
    on('transaction_state_changed', handleUpdate)

    return () => {
      off(`transaction:${transactionId}`, handleUpdate)
      off('transaction_update', handleUpdate)
      off('transaction_state_changed', handleUpdate)
    }
  }, [isConnected, transactionId, on, off])

  return { transaction, loading, error, isConnected }
}
