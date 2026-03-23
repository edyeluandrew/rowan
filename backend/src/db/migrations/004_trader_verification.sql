-- ============================================================
-- ROWAN — Trader Verification System
-- Run AFTER 003_admin_columns.sql
-- ============================================================

-- ─── New enums ──────────────────────────────────────────────

CREATE TYPE verification_status AS ENUM (
  'SUBMITTED',        -- trader has been onboarded, awaiting doc upload
  'DOCUMENTS_PENDING',-- docs uploaded, awaiting admin review
  'UNDER_REVIEW',     -- admin is actively reviewing
  'VERIFIED',         -- all checks passed, trader may receive matches
  'REJECTED',         -- one or more checks failed
  'SUSPENDED'         -- post-verification suspension (fraud/compliance)
);

CREATE TYPE check_status AS ENUM (
  'PENDING',          -- not yet reviewed
  'PASSED',           -- admin confirmed OK
  'FAILED'            -- admin rejected
);

CREATE TYPE id_document_type AS ENUM (
  'NATIONAL_ID',
  'PASSPORT'
);

CREATE TYPE momo_verification_method AS ENUM (
  'OTP',              -- SMS OTP sent to the number on file
  'TEST_DEPOSIT'      -- small deposit from platform to confirm ownership
);

-- ─── Trader verifications table ─────────────────────────────

CREATE TABLE trader_verifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id             UUID NOT NULL UNIQUE REFERENCES traders(id) ON DELETE CASCADE,

  -- Identity
  legal_name            TEXT,
  id_document_type      id_document_type,
  id_document_number    TEXT,                 -- encrypted or hashed in prod
  id_document_front_key TEXT,                 -- storage key for front image
  id_document_back_key  TEXT,                 -- storage key for back image
  selfie_key            TEXT,                 -- storage key for selfie-with-ID

  -- Binance P2P
  binance_username      TEXT,
  binance_p2p_trades    INT,                  -- self-reported total completions
  binance_completion_rate NUMERIC(5,2),       -- e.g. 98.50%
  binance_screenshot_key TEXT,                -- storage key for P2P stats screenshot

  -- Trader agreement
  agreement_version     TEXT,                 -- e.g. 'v1.0'
  agreement_accepted_at TIMESTAMPTZ,

  -- Individual check results (set by admin)
  identity_check        check_status NOT NULL DEFAULT 'PENDING',
  momo_check            check_status NOT NULL DEFAULT 'PENDING',
  p2p_check             check_status NOT NULL DEFAULT 'PENDING',
  agreement_check       check_status NOT NULL DEFAULT 'PENDING',

  -- Overall status
  verification_status   verification_status NOT NULL DEFAULT 'SUBMITTED',

  -- Admin review
  reviewed_by           UUID REFERENCES users(id),
  review_notes          TEXT,
  reviewed_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tv_trader  ON trader_verifications (trader_id);
CREATE INDEX idx_tv_status  ON trader_verifications (verification_status);

-- ─── Trader mobile money accounts ───────────────────────────

CREATE TABLE trader_momo_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id               UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  network                 mobile_network NOT NULL,
  phone_number_hash       TEXT NOT NULL,          -- SHA-256 of actual phone number
  account_name            TEXT,                   -- name on MM account (for cross-check)
  verification_method     momo_verification_method,
  verification_status     check_status NOT NULL DEFAULT 'PENDING',
  verified_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(trader_id, network, phone_number_hash)
);

CREATE INDEX idx_momo_trader ON trader_momo_accounts (trader_id);

-- ─── Add verification_status column to traders table ────────

ALTER TABLE traders ADD COLUMN IF NOT EXISTS verification_status verification_status NOT NULL DEFAULT 'SUBMITTED';

-- ─── Index: matching engine uses verification_status ────────

CREATE INDEX IF NOT EXISTS idx_traders_verified
  ON traders (verification_status)
  WHERE verification_status = 'VERIFIED';

-- ─── Trigger: auto-update updated_at on new tables ──────────

CREATE TRIGGER trg_tv_updated
  BEFORE UPDATE ON trader_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_momo_updated
  BEFORE UPDATE ON trader_momo_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
