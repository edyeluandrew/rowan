/**
 * Mock for transactions API
 */

export const getTransactions = jest.fn(() => Promise.resolve({
  transactions: [],
  total: 0,
  pages: 1,
  page: 1,
}))

export const getTransaction = jest.fn(() => Promise.resolve({}))
export const updateTransaction = jest.fn(() => Promise.resolve({}))
