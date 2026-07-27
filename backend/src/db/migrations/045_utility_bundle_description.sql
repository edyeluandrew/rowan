-- B3: Human-readable data bundle label on utility purchases

ALTER TABLE utility_purchases
  ADD COLUMN IF NOT EXISTS bundle_description TEXT;

COMMENT ON COLUMN utility_purchases.bundle_description IS
  'Reloadly bundle label e.g. 471.70MB Mobile Data (data purchases only)';
