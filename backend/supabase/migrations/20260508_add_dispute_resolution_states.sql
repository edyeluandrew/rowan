-- ============================================================
-- Add Dispute Resolution States
-- Implements transaction states for pending dispute refund/release
-- ============================================================

-- ─── 1. Add new states to tx_state enum ──────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTE_REFUND_PENDING' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'DISPUTE_REFUND_PENDING' AFTER 'DISPUTE_OPENED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTE_RELEASE_PENDING' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'DISPUTE_RELEASE_PENDING' AFTER 'DISPUTE_REFUND_PENDING';
  END IF;
END $$;

-- ─── 2. Add timestamp columns for dispute resolution ──────

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_refund_tx CHAR(56);  -- Stellar tx hash
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_release_tx CHAR(56);  -- Stellar tx hash

-- ─── 3. Add dispute_id reference for audit trail ─────────

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_started_at TIMESTAMPTZ;

-- ─── 4. Create indexes for dispute state queries ─────────

CREATE INDEX IF NOT EXISTS idx_transactions_dispute_refund_pending 
  ON transactions (state) WHERE state = 'DISPUTE_REFUND_PENDING';

CREATE INDEX IF NOT EXISTS idx_transactions_dispute_release_pending 
  ON transactions (state) WHERE state = 'DISPUTE_RELEASE_PENDING';

CREATE INDEX IF NOT EXISTS idx_transactions_dispute_id 
  ON transactions (dispute_id) WHERE dispute_id IS NOT NULL;

-- ─── 5. Add comments explaining new states ────────────────

COMMENT ON COLUMN transactions.dispute_resolved_at IS 'Timestamp when admin resolved dispute';
COMMENT ON COLUMN transactions.dispute_refund_tx IS 'Stellar transaction hash for XLM refund in dispute';
COMMENT ON COLUMN transactions.dispute_release_tx IS 'Stellar transaction hash for USDC release in dispute';
