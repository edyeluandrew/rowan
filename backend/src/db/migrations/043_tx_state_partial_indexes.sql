-- Partial indexes that reference tx_state values added in 021.
-- Must run in a separate migration (PostgreSQL enum transaction rule).

CREATE INDEX IF NOT EXISTS idx_transactions_fiat_payout_submitted
  ON transactions (state) WHERE state = 'FIAT_PAYOUT_SUBMITTED';

CREATE INDEX IF NOT EXISTS idx_transactions_user_confirmation_pending
  ON transactions (state) WHERE state = 'USER_CONFIRMATION_PENDING';

CREATE INDEX IF NOT EXISTS idx_transactions_dispute_id
  ON transactions (dispute_id) WHERE dispute_id IS NOT NULL;
