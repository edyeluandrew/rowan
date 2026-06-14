-- ============================================================
-- Phase 2B: User-Win Refund Settlement
-- ============================================================
-- Adds a structured, human/ops-readable blocking reason for refunds
-- (e.g. USER_MISSING_USDC_TRUSTLINE) so a user-win dispute that cannot
-- yet settle on-chain stays in DISPUTE_REFUND_PENDING with a clear,
-- retryable reason instead of silently stalling.
--
-- The refund transaction hash itself reuses the existing
-- transactions.stellar_refund_tx column (already present since 001).
--
-- SELF-CONTAINED + IDEMPOTENT.
-- ============================================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS refund_error TEXT;

COMMENT ON COLUMN transactions.refund_error IS
  'Phase 2B: structured blocking/failure reason for a user-win USDC refund '
  '(e.g. USER_MISSING_USDC_TRUSTLINE, INSUFFICIENT_ESCROW_BALANCE, REFUND_TX_FAILED). '
  'NULL when no refund is pending or once the refund succeeds.';

COMMENT ON COLUMN transactions.stellar_refund_tx IS
  'On-chain refund tx hash. Pre-2B: XLM auto-refund (no trader / swap failed). '
  '2B+: also the USDC escrow→user refund hash for user-win dispute settlement.';
