/**
 * Example hook test file
 * Tests for data fetching hooks
 */

import { renderHook, waitFor } from '@testing-library/react'
import useTransactions from '../useTransactions'
import * as transactionsAPI from '../../../../shared/services/api/transactions'

jest.mock('../../../../shared/services/api/transactions')

describe('useTransactions', () => {
  it('should fetch transactions successfully', async () => {
    const mockData = {
      transactions: [{ id: 1, amount: 100 }],
      total: 1,
      pages: 1,
      page: 1,
    }

    transactionsAPI.getTransactions.mockResolvedValue(mockData)

    const { result } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData.transactions)
    expect(result.current.total).toBe(1)
  })

  it('should handle errors', async () => {
    transactionsAPI.getTransactions.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeDefined()
  })

  it('should support pagination', async () => {
    const mockData = {
      transactions: [{ id: 1, amount: 100 }],
      total: 100,
      pages: 5,
      page: 2,
    }

    transactionsAPI.getTransactions.mockResolvedValue(mockData)

    const { result } = renderHook(() => useTransactions())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.page).toBe(2)
    expect(result.current.pages).toBe(5)
  })
})
