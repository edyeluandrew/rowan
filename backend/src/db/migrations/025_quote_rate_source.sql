-- ============================================================
-- Phase 2C: Rate source / liquidity safety metadata on quotes
-- ============================================================
-- Records whether a quote was priced from a LIVE Horizon path or a
-- FALLBACK rate, plus a human-readable warning. Lets clients/admin see
-- when a quote did not come from real executable liquidity.
--
-- SELF-CONTAINED + IDEMPOTENT.
-- ============================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rate_source TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_warning TEXT;

COMMENT ON COLUMN quotes.rate_source IS
  'Phase 2C: LIVE (priced from a real Horizon strict-receive path) or FALLBACK '
  '(priced from legacy/indicative rates because path discovery was unavailable).';
COMMENT ON COLUMN quotes.quote_warning IS
  'Phase 2C: optional human-readable warning when a quote is not backed by live liquidity.';
