-- Phase 2 B2/B6: Utility purchases (airtime, data, bills) + USDC payment tracking

CREATE TYPE utility_type AS ENUM ('airtime', 'data', 'bill');
CREATE TYPE utility_purchase_status AS ENUM (
  'QUOTED',
  'PENDING_PAYMENT',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE IF NOT EXISTS utility_purchases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  utility_type        utility_type NOT NULL DEFAULT 'airtime',
  country_code        CHAR(2) NOT NULL,
  network_code        TEXT NOT NULL,
  operator_id         TEXT,
  operator_name       TEXT,
  recipient_phone     TEXT NOT NULL,
  fiat_amount         NUMERIC(18,2) NOT NULL,
  fiat_currency       CHAR(3) NOT NULL,
  usdc_amount         NUMERIC(18,7) NOT NULL,
  platform_fee_usdc   NUMERIC(18,7) NOT NULL DEFAULT 0,
  fx_rate             NUMERIC(18,7),
  status              utility_purchase_status NOT NULL DEFAULT 'QUOTED',
  memo                TEXT NOT NULL,
  payment_tx_hash     TEXT,
  external_ref        TEXT,
  provider            TEXT NOT NULL DEFAULT 'reloadly',
  error_message       TEXT,
  receipt             JSONB NOT NULL DEFAULT '{}',
  expires_at          TIMESTAMPTZ NOT NULL,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_utility_purchases_memo
  ON utility_purchases (memo);

CREATE UNIQUE INDEX IF NOT EXISTS idx_utility_purchases_payment_tx
  ON utility_purchases (payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_utility_purchases_user_created
  ON utility_purchases (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_utility_purchases_status
  ON utility_purchases (status)
  WHERE status IN ('QUOTED', 'PENDING_PAYMENT', 'PROCESSING');

COMMENT ON TABLE utility_purchases IS 'USDC-funded utility purchases (airtime/bills). User pays USDC on-chain to utility treasury; backend calls Reloadly.';
