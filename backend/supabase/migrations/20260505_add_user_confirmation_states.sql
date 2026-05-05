-- ============================================================
-- Add User Confirmation States and Payout Reference
-- Implements user-side receipt confirmation for cashout escrow
-- ============================================================

-- ─── 1. Add new timestamp columns for state tracking ────────

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fiat_payout_submitted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_confirmation_pending_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_confirmed_receipt_at TIMESTAMPTZ;

-- ─── 2. Add payout reference column for trader's mobile money ref ──

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_reference TEXT;

-- ─── 3. Create indexes for new state queries ────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_fiat_payout_submitted 
  ON transactions (state) WHERE state = 'FIAT_PAYOUT_SUBMITTED';

CREATE INDEX IF NOT EXISTS idx_transactions_user_confirmation_pending 
  ON transactions (state) WHERE state = 'USER_CONFIRMATION_PENDING';

-- ─── 4. Drop old FIAT_SENT state constraint if any exists ────────
-- (This assumes the state enum or check constraint has already been updated by Supabase)
-- Supabase will handle enum updates separately in its UI

-- ─── 5. Add comment explaining new workflow ─────────────────────

COMMENT ON COLUMN transactions.payout_reference IS 'Mobile money reference provided by trader (MTN/Airtel/M-Pesa reference number)';
COMMENT ON COLUMN transactions.fiat_payout_submitted_at IS 'Timestamp when trader submitted payout reference';
COMMENT ON COLUMN transactions.user_confirmation_pending_at IS 'Timestamp when user saw confirmation prompt';
COMMENT ON COLUMN transactions.user_confirmed_receipt_at IS 'Timestamp when user confirmed receipt of mobile money';
