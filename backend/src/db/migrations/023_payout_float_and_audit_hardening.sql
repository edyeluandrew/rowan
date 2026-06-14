-- ============================================================
-- Phase 2A: Float Accounting + Audit Logging Hardening (B2 + B3)
-- ============================================================
-- This migration is SELF-CONTAINED and IDEMPOTENT. The objects below
-- previously only existed in the (non-auto-run) supabase/migrations tree,
-- so we (re)assert them here so the auto-run migration path produces a
-- correct schema on both the live DB and a fresh database.
-- ============================================================

-- ─── 1. trader_payout_settings (canonical float source) ──────
CREATE TABLE IF NOT EXISTS trader_payout_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id         UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  country           TEXT NOT NULL,
  network           mobile_network NOT NULL,
  currency          TEXT NOT NULL,
  min_amount        NUMERIC(18,2) NOT NULL,
  max_amount        NUMERIC(18,2) NOT NULL,
  available_float   NUMERIC(18,2) NOT NULL,
  reserved_float    NUMERIC(18,2) NOT NULL DEFAULT 0,
  rate_per_usdc     NUMERIC(18,7),
  spread_percent    NUMERIC(5,2),
  fee_percent       NUMERIC(5,2),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_amounts CHECK (max_amount > min_amount AND min_amount >= 0),
  CONSTRAINT chk_float CHECK (available_float >= 0 AND reserved_float >= 0),
  UNIQUE (trader_id, network, currency)
);

-- ─── 2. transactions.payout_setting_id (links tx → float setting) ──
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payout_setting_id UUID REFERENCES trader_payout_settings(id) ON DELETE SET NULL;

-- ─── 3. transactions.float_settled (idempotency guard for finalize/release-reservation) ──
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS float_settled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS float_settled_at TIMESTAMPTZ;

-- ─── 4. Matching indexes ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_payout_setting ON transactions (payout_setting_id);
CREATE INDEX IF NOT EXISTS idx_tps_trader ON trader_payout_settings (trader_id);
CREATE INDEX IF NOT EXISTS idx_tps_active ON trader_payout_settings (trader_id, is_active);
CREATE INDEX IF NOT EXISTS idx_tps_match ON trader_payout_settings (network, currency, is_active);

-- ─── 5. audit_logs (B3): ensure table exists with NULLABLE admin_id ──
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        UUID,
  actor_role      TEXT NOT NULL DEFAULT 'system',
  action          TEXT NOT NULL,
  resource_type   TEXT,
  resource_id     UUID,
  old_value       JSONB DEFAULT '{}',
  new_value       JSONB DEFAULT '{}',
  metadata        JSONB DEFAULT '{}',
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B3 ROOT CAUSE FIX: the live audit_logs table was created with admin_id
-- NOT NULL (no default). Every system/non-admin audit insert (escrow release,
-- and even dispute resolution, which only stored admin_id in metadata) failed
-- with 23502 and was silently swallowed. Make admin_id nullable.
ALTER TABLE audit_logs ALTER COLUMN admin_id DROP NOT NULL;

-- A legacy "details" column may exist with NOT NULL; ensure it exists (so the
-- ALTERs below are safe on fresh DBs) then relax it so inserts that only
-- populate the canonical columns succeed regardless of which historical
-- audit_logs definition is present.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ALTER COLUMN details DROP NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN details SET DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs (admin_id, created_at DESC);

-- ─── 6. Backfill payout settings for existing verified, releasable traders ──
-- SAFE + ADDITIVE: only VERIFIED + ACTIVE traders that have a stellar_address
-- (i.e. can actually receive USDC). Maps each supported network to its currency
-- and seeds available_float from the matching legacy float_* column. Skips any
-- (trader, network, currency) that already has a setting. Does NOT modify or
-- delete existing settings or legacy float columns.
INSERT INTO trader_payout_settings
  (trader_id, country, network, currency, min_amount, max_amount, available_float, reserved_float, is_active)
SELECT t.id,
       CASE m.cur WHEN 'KES' THEN 'Kenya' WHEN 'TZS' THEN 'Tanzania' ELSE 'Uganda' END,
       m.net::mobile_network,
       m.cur,
       0,
       GREATEST(CASE m.cur WHEN 'KES' THEN t.float_kes WHEN 'TZS' THEN t.float_tzs ELSE t.float_ugx END, 1)::numeric(18,2),
       GREATEST(CASE m.cur WHEN 'KES' THEN t.float_kes WHEN 'TZS' THEN t.float_tzs ELSE t.float_ugx END, 0)::numeric(18,2),
       0,
       TRUE
FROM traders t
JOIN (VALUES
  ('MPESA_KE','KES'),
  ('MTN_UG','UGX'),
  ('AIRTEL_UG','UGX'),
  ('MTN_TZ','TZS'),
  ('AIRTEL_TZ','TZS')
) AS m(net, cur) ON m.net = ANY (t.networks)
WHERE t.status = 'ACTIVE'
  AND t.verification_status = 'VERIFIED'
  AND t.stellar_address IS NOT NULL
ON CONFLICT (trader_id, network, currency) DO NOTHING;

-- ─── 7. Mark legacy float columns as read-only / non-canonical ──
COMMENT ON COLUMN traders.float_ugx IS 'LEGACY (pre-Phase2A). Canonical float now lives in trader_payout_settings.available_float/reserved_float. Read-only.';
COMMENT ON COLUMN traders.float_kes IS 'LEGACY (pre-Phase2A). Canonical float now lives in trader_payout_settings. Read-only.';
COMMENT ON COLUMN traders.float_tzs IS 'LEGACY (pre-Phase2A). Canonical float now lives in trader_payout_settings. Read-only.';
COMMENT ON COLUMN transactions.float_settled IS 'TRUE once payout-setting float has been finalized (complete/trader-win) or reservation released (user-win). Idempotency guard preventing double float adjustment.';
