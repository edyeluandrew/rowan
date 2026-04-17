-- Migration 020: Quote Engine Alignment with Stellar Paths
-- Purpose: Support Phase 2-4 improvements for quote generation using real Horizon path discovery
-- Changes:
--   1. Add path discovery columns to quotes table
--   2. Add quote source tracking for debugging/monitoring
--   3. Support aligned quote/execution model

-- Add new columns to quotes table for path discovery
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS path_xlm_needed NUMERIC(18,7),
  ADD COLUMN IF NOT EXISTS path_usdc_received NUMERIC(18,7),
  ADD COLUMN IF NOT EXISTS quote_source TEXT DEFAULT 'legacy';

-- Create index on quote_source for filtering/debugging
CREATE INDEX IF NOT EXISTS idx_quotes_source 
  ON quotes(quote_source);

-- Create index on path columns for validation/monitoring
CREATE INDEX IF NOT EXISTS idx_quotes_path_data 
  ON quotes(path_xlm_needed, path_usdc_received) 
  WHERE path_xlm_needed IS NOT NULL AND path_usdc_received IS NOT NULL;

-- Backfill quote_source for existing quotes to 'legacy'
UPDATE quotes 
  SET quote_source = 'legacy' 
  WHERE quote_source IS NULL OR quote_source = '';

-- Make quote_source NOT NULL after backfill
ALTER TABLE quotes
  ALTER COLUMN quote_source SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN quotes.path_xlm_needed IS 
  'XLM amount needed to achieve target USDC (from Horizon strict-receive path discovery)';
COMMENT ON COLUMN quotes.path_usdc_received IS 
  'USDC amount that will be received (from Horizon strict-receive path discovery)';
COMMENT ON COLUMN quotes.quote_source IS
  'Source of quote rate: legacy (DEX/CoinGecko) or horizon-path (real path discovery)';
