-- ============================================================
-- ROWAN — Core Schema Migration
-- Run against your Supabase PostgreSQL instance
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ──────────────────────────────────────────────────

CREATE TYPE tx_state AS ENUM (
  'QUOTE_REQUESTED',
  'QUOTE_CONFIRMED',
  'ESCROW_LOCKED',
  'TRADER_MATCHED',
  'FIAT_SENT',
  'COMPLETE',
  'FAILED',
  'REFUNDED'
);

CREATE TYPE mobile_network AS ENUM (
  'MPESA_KE',
  'MTN_UG',
  'AIRTEL_UG',
  'MTN_TZ',
  'AIRTEL_TZ'
);

CREATE TYPE kyc_level AS ENUM (
  'NONE',
  'BASIC',
  'VERIFIED'
);

CREATE TYPE dispute_status AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED_FOR_USER',
  'RESOLVED_FOR_TRADER',
  'DISMISSED'
);

-- ─── 1. USERS ───────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stellar_address TEXT NOT NULL UNIQUE,               -- public key only, never a secret
  phone_hash      TEXT NOT NULL,                       -- SHA-256 of phone number
  kyc_level       kyc_level NOT NULL DEFAULT 'NONE',
  daily_limit     NUMERIC(18,7) NOT NULL DEFAULT 500,  -- max XLM per day
  per_tx_limit    NUMERIC(18,7) NOT NULL DEFAULT 200,  -- max XLM per transaction
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  device_id       TEXT,                                -- bound device fingerprint
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_stellar ON users (stellar_address);
CREATE INDEX idx_users_phone   ON users (phone_hash);

-- ─── 2. TRADERS ─────────────────────────────────────────────

CREATE TABLE traders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  stellar_address TEXT NOT NULL UNIQUE,                -- public key for USDC receipt
  usdc_float      NUMERIC(18,7) NOT NULL DEFAULT 0,    -- current available float
  daily_limit     NUMERIC(18,7) NOT NULL DEFAULT 5000,  -- max USDC per day
  daily_volume    NUMERIC(18,7) NOT NULL DEFAULT 0,     -- USDC moved today
  trust_score     NUMERIC(5,2) NOT NULL DEFAULT 100.00, -- 0-100
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_suspended    BOOLEAN NOT NULL DEFAULT FALSE,
  device_id       TEXT,
  password_hash   TEXT NOT NULL,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_traders_active ON traders (is_active, is_suspended, trust_score DESC);

-- ─── 3. QUOTES ──────────────────────────────────────────────

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  xlm_amount      NUMERIC(18,7) NOT NULL,
  fiat_currency   TEXT NOT NULL DEFAULT 'UGX',         -- ISO 4217
  market_rate     NUMERIC(18,7) NOT NULL,              -- raw XLM/fiat rate
  user_rate       NUMERIC(18,7) NOT NULL,              -- rate shown to user (after spread)
  fiat_amount     NUMERIC(18,2) NOT NULL,              -- total fiat user receives
  platform_fee    NUMERIC(18,2) NOT NULL,              -- fee in fiat
  network         mobile_network NOT NULL,
  phone_hash      TEXT NOT NULL,
  memo            TEXT NOT NULL UNIQUE,                 -- 'ROWAN-qt_xxxx'
  escrow_address  TEXT NOT NULL,
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  is_used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_memo    ON quotes (memo);
CREATE INDEX idx_quotes_user    ON quotes (user_id);
CREATE INDEX idx_quotes_expires ON quotes (expires_at) WHERE is_used = FALSE;

-- ─── 4. TRANSACTIONS ────────────────────────────────────────

CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            UUID NOT NULL REFERENCES quotes(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  trader_id           UUID REFERENCES traders(id),         -- NULL until matched
  xlm_amount          NUMERIC(18,7) NOT NULL,
  usdc_amount         NUMERIC(18,7),                       -- NULL until swap completes
  fiat_amount         NUMERIC(18,2) NOT NULL,
  fiat_currency       TEXT NOT NULL DEFAULT 'UGX',
  network             mobile_network NOT NULL,
  phone_hash          TEXT NOT NULL,
  state               tx_state NOT NULL DEFAULT 'QUOTE_CONFIRMED',
  stellar_deposit_tx  TEXT,                                 -- user's deposit tx hash
  stellar_swap_tx     TEXT,                                 -- XLM→USDC swap tx hash
  stellar_release_tx  TEXT,                                 -- escrow→trader release tx hash
  stellar_refund_tx   TEXT,                                 -- refund tx hash (if any)
  locked_rate         NUMERIC(18,7) NOT NULL,
  quote_confirmed_at  TIMESTAMPTZ,
  escrow_locked_at    TIMESTAMPTZ,
  trader_matched_at   TIMESTAMPTZ,
  fiat_sent_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_state   ON transactions (state);
CREATE INDEX idx_tx_user    ON transactions (user_id);
CREATE INDEX idx_tx_trader  ON transactions (trader_id);
CREATE INDEX idx_tx_quote   ON transactions (quote_id);

-- ─── 5. DISPUTES ────────────────────────────────────────────

CREATE TABLE disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  trader_id       UUID NOT NULL REFERENCES traders(id),
  reason          TEXT NOT NULL,
  status          dispute_status NOT NULL DEFAULT 'OPEN',
  admin_notes     TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_trader ON disputes (trader_id, status);
CREATE INDEX idx_disputes_tx     ON disputes (transaction_id);

-- ─── TRIGGER: auto-update updated_at ────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_traders_updated       BEFORE UPDATE ON traders      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transactions_updated  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_disputes_updated      BEFORE UPDATE ON disputes     FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── FUNCTION: reset trader daily volume (run via cron) ─────

CREATE OR REPLACE FUNCTION reset_trader_daily_volume()
RETURNS void AS $$
BEGIN
  UPDATE traders SET daily_volume = 0;
END;
$$ LANGUAGE plpgsql;
