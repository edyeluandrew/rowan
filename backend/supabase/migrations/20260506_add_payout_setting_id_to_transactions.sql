-- ============================================================
-- Add payout_setting_id to transactions table for float tracking
-- Phase 3: Trader Float Reservation Lifecycle
-- Date: 2026-05-06
-- ============================================================

-- Add payout_setting_id foreign key column
ALTER TABLE transactions
ADD COLUMN payout_setting_id UUID REFERENCES trader_payout_settings(id) ON DELETE SET NULL;

-- Create index for fast lookup
CREATE INDEX idx_transactions_payout_setting ON transactions(payout_setting_id);

-- Add comment
COMMENT ON COLUMN transactions.payout_setting_id IS 'References the trader payout setting used for this transaction. Links transaction to specific network/currency configuration for float reservation tracking.';
