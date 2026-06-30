-- Manual P2P Buy (mirror of backend/src/db/migrations/039_p2p_buy.sql)

DO $$ BEGIN
  CREATE TYPE order_side AS ENUM ('SELL', 'BUY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS order_side order_side NOT NULL DEFAULT 'SELL';

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS order_side order_side NOT NULL DEFAULT 'SELL';

ALTER TABLE trader_payout_settings
  ADD COLUMN IF NOT EXISTS ad_side TEXT NOT NULL DEFAULT 'USER_SELL'
    CHECK (ad_side IN ('USER_SELL', 'USER_BUY'));

ALTER TABLE trader_payout_settings
  ADD COLUMN IF NOT EXISTS available_usdc NUMERIC(18,7) NOT NULL DEFAULT 0;

ALTER TABLE trader_payout_settings
  ADD COLUMN IF NOT EXISTS reserved_usdc NUMERIC(18,7) NOT NULL DEFAULT 0;

ALTER TABLE trader_payout_settings
  DROP CONSTRAINT IF EXISTS chk_usdc_float;

ALTER TABLE trader_payout_settings
  ADD CONSTRAINT chk_usdc_float
    CHECK (available_usdc >= 0 AND reserved_usdc >= 0);

CREATE INDEX IF NOT EXISTS idx_payout_ad_side
  ON trader_payout_settings (ad_side, network, currency, is_active);

ALTER TABLE trader_payout_settings
  DROP CONSTRAINT IF EXISTS trader_payout_settings_trader_id_network_currency_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payout_trader_network_side
  ON trader_payout_settings (trader_id, network, currency, ad_side);
