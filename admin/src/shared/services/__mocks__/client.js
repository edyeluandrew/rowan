/**
 * Mock for client.js for testing
 */

export const setClientToken = jest.fn()
export const getClientToken = jest.fn(() => null)
export const setClientLogout = jest.fn()

const mockClient = {
  get: jest.fn(() => Promise.resolve({})),
  post: jest.fn(() => Promise.resolve({})),
  put: jest.fn(() => Promise.resolve({})),
  delete: jest.fn(() => Promise.resolve({})),
  patch: jest.fn(() => Promise.resolve({})),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
}

export default mockClient
