-- Add dispute-related transaction states
-- Supports transaction state transitions during dispute resolution

-- 1. Extend tx_state enum with dispute states
-- Drop the default constraint first
ALTER TABLE transactions ALTER COLUMN state DROP DEFAULT;

-- Rename old enum and create new one
ALTER TYPE tx_state RENAME TO tx_state_old;

CREATE TYPE tx_state AS ENUM (
  'QUOTE_REQUESTED',
  'QUOTE_CONFIRMED',
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_SENT',
  'COMPLETE',
  'FAILED',
  'REFUNDED',
  'DISPUTE_OPENED',
  'DISPUTE_REFUND_PENDING',
  'DISPUTE_RELEASE_PENDING',
  'DISPUTED_REFUNDED',
  'DISPUTED_RELEASED'
);

-- Cast column to new enum type
ALTER TABLE transactions
  ALTER COLUMN state TYPE tx_state USING state::text::tx_state;

-- Re-add the default constraint
ALTER TABLE transactions ALTER COLUMN state SET DEFAULT 'QUOTE_CONFIRMED';

DROP TYPE tx_state_old;

-- 2. Add dispute-related columns to transactions if not exists
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS dispute_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;

-- 3. Create index for monitoring disputed transactions
CREATE INDEX IF NOT EXISTS idx_tx_disputed_state 
  ON transactions(state) 
  WHERE state IN ('DISPUTE_OPENED', 'DISPUTE_REFUND_PENDING', 'DISPUTE_RELEASE_PENDING', 'DISPUTED_REFUNDED', 'DISPUTED_RELEASED');
