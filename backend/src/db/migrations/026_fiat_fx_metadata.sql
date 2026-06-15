-- Phase 2F: Fiat FX source metadata on quotes (STATIC / LIVE / FALLBACK / UNAVAILABLE seam)
-- SELF-CONTAINED + IDEMPOTENT.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_source TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_rate NUMERIC;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_currency TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fx_warning TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fiat_rate_source TEXT;

COMMENT ON COLUMN quotes.fx_source IS
  'Phase 2F: STATIC | LIVE | FALLBACK | UNAVAILABLE — source of USDC→fiat conversion rate.';
COMMENT ON COLUMN quotes.fx_rate IS 'Phase 2F: USDC→fiat rate used when quote was created.';
COMMENT ON COLUMN quotes.fx_currency IS 'Phase 2F: fiat currency code for fx_rate (UGX/KES/TZS).';
COMMENT ON COLUMN quotes.fx_warning IS 'Phase 2F: human-readable warning when fiat FX is not live.';
COMMENT ON COLUMN quotes.fiat_rate_source IS 'Phase 2F: alias/detail for fx_source (e.g. env:USDC_RATE_UGX).';
