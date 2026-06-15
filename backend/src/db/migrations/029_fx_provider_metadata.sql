-- Phase 2H-4: Extended fiat FX metadata on quotes (provider, fetch time, age)
-- SELF-CONTAINED + IDEMPOTENT.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_provider TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_fetched_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_age_seconds INTEGER;

COMMENT ON COLUMN quotes.fx_provider IS
  'Phase 2H-4: live FX provider id (e.g. exchange-rate-api, static-config).';
COMMENT ON COLUMN quotes.fx_fetched_at IS
  'Phase 2H-4: when the live FX rate was fetched (null for STATIC).';
COMMENT ON COLUMN quotes.fx_age_seconds IS
  'Phase 2H-4: age in seconds of FX rate at quote creation time.';
