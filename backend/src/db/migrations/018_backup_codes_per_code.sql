-- Migration 018: Refactor backup codes to per-code storage
-- Purpose: Allow individual backup code tracking, usage tracking, and invalidation

-- Create backup codes table (one row per code)
CREATE TABLE IF NOT EXISTS trader_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trader_backup_codes_trader_id 
  ON trader_backup_codes(trader_id);

CREATE INDEX IF NOT EXISTS idx_trader_backup_codes_used 
  ON trader_backup_codes(trader_id, used_at);

-- Migrate backup_codes_hash from trader_2fa_settings to new table
-- This is handled in application code during transition

-- Keep backup_codes_remaining for quick status check
-- (will be computed from table, but kept for convenience)
