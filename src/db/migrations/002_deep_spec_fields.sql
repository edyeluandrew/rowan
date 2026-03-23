-- ============================================================
-- ROWAN — Schema Addendum: Fields from Deep Architecture Spec
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ─── Trader status enum ─────────────────────────────────────
CREATE TYPE trader_status AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED', 'BANNED');

-- ─── Quote status enum ──────────────────────────────────────
CREATE TYPE quote_status AS ENUM (
  'PENDING', 'CONFIRMED', 'ESCROW_LOCKED', 'MATCHED',
  'FIAT_SENT', 'COMPLETE', 'FAILED', 'REFUNDED'
);

-- ─── USERS: add UGX-denominated daily limit ─────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_limit_ugx BIGINT NOT NULL DEFAULT 500000;

-- ─── TRADERS: add deep-spec fields ──────────────────────────
ALTER TABLE traders ADD COLUMN IF NOT EXISTS networks TEXT[] DEFAULT '{}';
ALTER TABLE traders ADD COLUMN IF NOT EXISTS float_ugx BIGINT NOT NULL DEFAULT 0;
ALTER TABLE traders ADD COLUMN IF NOT EXISTS daily_limit_ugx BIGINT NOT NULL DEFAULT 15000000;
ALTER TABLE traders ADD COLUMN IF NOT EXISTS status trader_status NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE traders ADD COLUMN IF NOT EXISTS wholesale_rate_ugx BIGINT NOT NULL DEFAULT 3950;

-- ─── QUOTES: add deep-spec fields ──────────────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS rate_ugx BIGINT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS fee_ugx BIGINT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status quote_status NOT NULL DEFAULT 'PENDING';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stellar_tx_hash TEXT;

-- ─── TRANSACTIONS: add deep-spec fields ─────────────────────
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS platform_revenue_ugx BIGINT NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fiat_confirmed_at TIMESTAMPTZ;

-- ─── Index: trader network matching ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_traders_networks ON traders USING gin (networks);
CREATE INDEX IF NOT EXISTS idx_traders_float    ON traders (float_ugx) WHERE status = 'ACTIVE';
