-- ============================================================
-- ROWAN — Fix daily_volume unit: track in UGX not USDC
-- Also add float_kes and float_tzs columns for multi-currency float
-- ============================================================

-- Rename the COMMENT on daily_volume to clarify it tracks UGX
COMMENT ON COLUMN traders.daily_volume IS 'Fiat volume moved today in UGX equivalent — reset at midnight UTC via cron';

-- Add multi-currency float columns
ALTER TABLE traders ADD COLUMN IF NOT EXISTS float_kes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE traders ADD COLUMN IF NOT EXISTS float_tzs BIGINT NOT NULL DEFAULT 0;

-- Add refunded_at timestamp to transactions (used for orphan recovery)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Add RELEASE_BLOCKED to the tx_state enum (for trustline failures)
-- Note: ALTER TYPE ADD VALUE is not transactional in PG, must be outside transaction
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RELEASE_BLOCKED' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'RELEASE_BLOCKED' AFTER 'FIAT_SENT';
  END IF;
END $$;
