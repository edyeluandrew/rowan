-- Max concurrent active orders per trader

ALTER TABLE traders ADD COLUMN IF NOT EXISTS max_concurrent_orders INTEGER NOT NULL DEFAULT 3;

ALTER TABLE traders ADD CONSTRAINT chk_max_concurrent_orders
  CHECK (max_concurrent_orders >= 1 AND max_concurrent_orders <= 20);

COMMENT ON COLUMN traders.max_concurrent_orders IS 'Max simultaneous active orders before hidden from marketplace/matching';
