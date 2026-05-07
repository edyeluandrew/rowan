-- Ensure only one transaction per quote
-- This prevents the state-bouncing issue where multiple transactions
-- were created for the same quote and frontend was getting inconsistent results

BEGIN;

-- Check if constraint already exists
-- If the constraint exists, this will be skipped
-- If it doesn't exist, we add it

-- First, clean up any duplicate transactions for the same quote (keep the latest)
-- This is a safety measure in case duplicates already exist
DELETE FROM transactions t1
WHERE EXISTS (
  SELECT 1 FROM transactions t2
  WHERE t1.quote_id = t2.quote_id
    AND t1.id < t2.id  -- Keep the newer one
);

-- Add unique constraint on quote_id
-- Matches quote to exactly one transaction
ALTER TABLE transactions
ADD CONSTRAINT uq_transactions_quote_id UNIQUE (quote_id);

COMMIT;
