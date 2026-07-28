-- Phase 2 C1/C9: Track which payment rail settled a transaction

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payout_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_rail TEXT,
  ADD COLUMN IF NOT EXISTS aggregator_ref TEXT;

COMMENT ON COLUMN transactions.payout_provider IS 'yellow_pay | p2p_trader — primary rail attempted or used';
COMMENT ON COLUMN transactions.payment_rail IS 'Duplicate alias for reporting; prefer payout_provider';
COMMENT ON COLUMN transactions.aggregator_ref IS 'External reference from Yellow Pay or other aggregator';

CREATE INDEX IF NOT EXISTS idx_transactions_payout_provider
  ON transactions (payout_provider)
  WHERE payout_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_aggregator_ref
  ON transactions (aggregator_ref)
  WHERE aggregator_ref IS NOT NULL;
