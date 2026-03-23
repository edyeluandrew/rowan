-- ============================================================
-- ROWAN — Schema cleanup: quote lifecycle, dead letter, model sync
-- ============================================================

-- ─── M-1: Add missing model columns ────────────────────────

-- Traders: ensure float_kes, float_tzs exist (also in 010, idempotent)
ALTER TABLE traders ADD COLUMN IF NOT EXISTS float_kes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE traders ADD COLUMN IF NOT EXISTS float_tzs BIGINT NOT NULL DEFAULT 0;

-- ─── M-3: Quote status lifecycle ────────────────────────────
-- quotes.status already exists (from 002) with default 'PENDING'
-- No new column needed, just need app code to update it

-- ─── M-4: Dead letter jobs table ────────────────────────────

CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue           TEXT NOT NULL,
  job_data        JSONB NOT NULL,
  error_message   TEXT,
  attempts        INT NOT NULL DEFAULT 0,
  failed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlj_queue ON dead_letter_jobs (queue);
CREATE INDEX IF NOT EXISTS idx_dlj_resolved ON dead_letter_jobs (resolved_at) WHERE resolved_at IS NULL;

-- ─── L-4: Fraud alerts table ───────────────────────────────

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  trader_id       UUID REFERENCES traders(id),
  alert_type      TEXT NOT NULL,
  details         TEXT,
  severity        TEXT NOT NULL DEFAULT 'MEDIUM',
  acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fa_type ON fraud_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_fa_unack ON fraud_alerts (acknowledged) WHERE acknowledged = FALSE;
