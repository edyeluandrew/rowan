/**
 * Normalize wallet transaction DTOs from API (snake_case) to UI shape (camelCase).
 */
export function normalizeWalletTransaction(tx) {
  if (!tx || typeof tx !== 'object') return null

  return {
    id: tx.id,
    state: tx.state,
    network: tx.network,
    xlmAmount: tx.xlmAmount ?? tx.xlm_amount ?? 0,
    fiatAmount: tx.fiatAmount ?? tx.fiat_amount ?? 0,
    currency: tx.currency ?? tx.fiat_currency ?? 'UGX',
    createdAt: tx.createdAt ?? tx.created_at,
    usdcAmount: tx.usdcAmount ?? tx.usdc_amount,
    stellarDepositTx: tx.stellarDepositTx ?? tx.stellar_deposit_tx,
    stellarReleaseTx: tx.stellarReleaseTx ?? tx.stellar_release_tx,
    completedAt: tx.completedAt ?? tx.completed_at,
    failedAt: tx.failedAt ?? tx.failed_at,
    hasDispute: tx.hasDispute ?? !!tx.dispute_id,
    fiatCurrency: tx.fiatCurrency ?? tx.fiat_currency ?? 'UGX',
    quoteConfirmedAt: tx.quoteConfirmedAt ?? tx.quote_confirmed_at,
    escrowLockedAt: tx.escrowLockedAt ?? tx.escrow_locked_at,
    traderMatchedAt: tx.traderMatchedAt ?? tx.trader_matched_at,
    fiatPayoutSubmittedAt: tx.fiatPayoutSubmittedAt ?? tx.fiat_payout_submitted_at,
    userConfirmationPendingAt: tx.userConfirmationPendingAt ?? tx.user_confirmation_pending_at,
  }
}

export function getTransactionStatusTimestamps(tx) {
  if (!tx) return {}

  return {
    QUOTE_CONFIRMED: tx.quoteConfirmedAt,
    ESCROW_LOCKED: tx.escrowLockedAt,
    TRADER_MATCHED: tx.traderMatchedAt,
    FIAT_PAYOUT_SUBMITTED: tx.fiatPayoutSubmittedAt,
    USER_CONFIRMATION_PENDING: tx.userConfirmationPendingAt,
    COMPLETE: tx.completedAt,
  }
}

export function normalizeWalletTransactions(list) {
  if (!Array.isArray(list)) return []
  return list.map(normalizeWalletTransaction).filter(Boolean)
}

export function normalizeWalletHistoryStats(stats) {
  if (!stats || typeof stats !== 'object') return null

  const completed = Number(stats.total_completed ?? stats.completed ?? 0)
  const failed = Number(stats.total_failed ?? stats.failed ?? 0)

  return {
    completed,
    total: Number(stats.total ?? completed + failed),
    totalXlm: stats.total_xlm_cashed ?? stats.totalXlm ?? 0,
    totalFiatReceived: stats.total_fiat_received ?? stats.totalFiatReceived ?? 0,
  }
}

/** States where cashout is still in flight (not terminal). */
export const IN_PROGRESS_TX_STATES = [
  'QUOTE_CONFIRMED',
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_PAYOUT_SUBMITTED',
  'USER_CONFIRMATION_PENDING',
  'DISPUTE_OPENED',
  'DISPUTE_RELEASE_PENDING',
  'DISPUTE_REFUND_PENDING',
  'RELEASE_BLOCKED',
]

export const TERMINAL_TX_STATES = ['COMPLETE', 'REFUNDED', 'FAILED']

export function isTransactionInProgress(tx) {
  const state = tx?.state
  return state && IN_PROGRESS_TX_STATES.includes(state)
}

export function getInProgressTransactions(transactions) {
  if (!Array.isArray(transactions)) return []
  return transactions.filter(isTransactionInProgress)
}

export function normalizeWalletHistoryResponse(data) {
  if (!data || typeof data !== 'object') {
    return { transactions: [], stats: null }
  }

  const raw = data.transactions ?? data.data?.transactions ?? []
  return {
    transactions: normalizeWalletTransactions(raw),
    stats: normalizeWalletHistoryStats(data.stats),
  }
}
