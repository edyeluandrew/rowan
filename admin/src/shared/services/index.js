/**
 * Shared API Services — Convenience re-exports
 * Allows gradual migration from old import paths
 */
export { default as client, setClientToken, getClientToken, setClientLogout } from './client'
export * as authApi from './api/auth'
export * as transactionsApi from './api/transactions'
export * as tradersApi from './api/traders'
export * as overviewApi from './api/overview'
export * as disputesApi from './api/disputes'
export * as analyticsApi from './api/analytics'
export * as escrowApi from './api/escrow'
export * as systemApi from './api/system'
