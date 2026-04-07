-- ============================================================
-- Extended Disputes Table & Audit Logs
-- Adds missing fields for trader response, resolution tracking, and audit trail
-- ============================================================

-- ─── 1. Extend dispute_status enum (add new states) ────────

-- Drop old ENUM type and recreate with new values
ALTER TYPE dispute_status RENAME TO dispute_status_old;

CREATE TYPE dispute_status AS ENUM (
  'OPEN',
  'TRADER_RESPONDED',
  'UNDER_REVIEW',
  'ESCALATED',
  'RESOLVED_FOR_USER',
  'RESOLVED_FOR_TRADER',
  'DISMISSED',
  'CLOSED'
);

ALTER TABLE disputes ALTER COLUMN status TYPE dispute_status USING status::text::dispute_status;
DROP TYPE dispute_status_old;

-- ─── 2. Extended disputes table ──────────────────────────

-- Add missing columns to disputes table
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS trader_response TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS trader_response_at TIMESTAMPTZ;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS trader_proof_key TEXT;  -- Supabase Storage key
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS user_evidence_key TEXT;  -- Optional user proof file
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolution_reason TEXT;  -- Why dispute was resolved
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS resolved_by UUID;  -- Admin who resolved it
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS escalated_by UUID;  -- Admin who escalated
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS closure_reason TEXT;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ;  -- 48-72h from created

-- Create indexes for dispute queries
CREATE INDEX IF NOT EXISTS idx_disputes_user ON disputes (user_id, status);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes (status);
CREATE INDEX IF NOT EXISTS idx_disputes_sla ON disputes (sla_deadline) WHERE status NOT IN ('CLOSED', 'RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER');

-- ─── 3. Audit Logs Table ────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        TEXT,  -- admin email or user_id string
  actor_role      TEXT NOT NULL,  -- 'admin' | 'trader' | 'system'
  action          TEXT NOT NULL,  -- 'dispute_created', 'dispute_resolved', etc.
  resource_type   TEXT NOT NULL,  -- 'dispute' | 'transaction' | etc.
  resource_id     UUID,           -- dispute_id, transaction_id, etc.
  old_value       JSONB,          -- Previous state
  new_value       JSONB,          -- New state
  metadata        JSONB DEFAULT '{}',  -- Extra context (reason, notes, etc.)
  ip_address      TEXT,           -- For security tracking
  user_agent      TEXT,           -- Browser info
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs (created_at DESC);

-- ─── 4. Dead Letter Jobs Table (for failed dispute retries) ─

CREATE TABLE IF NOT EXISTS dead_letter_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue           TEXT NOT NULL,  -- 'dispute_resolution', 'dispute_notification', etc.
  job_data        JSONB NOT NULL,
  error_message   TEXT NOT NULL,
  attempts        INT DEFAULT 1,
  last_error_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_queue ON dead_letter_jobs (queue, resolved_at);
CREATE INDEX IF NOT EXISTS idx_dead_letter_date ON dead_letter_jobs (created_at DESC);

-- ─── 6. Dispute Resolution Evidence Table ──────────────

-- To store evidence files (photos, screenshots) linked to disputes
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  uploader_role   TEXT NOT NULL,  -- 'user' | 'trader' | 'admin'
  file_key        TEXT NOT NULL,  -- Supabase Storage key
  file_name       TEXT NOT NULL,
  file_type       TEXT,           -- 'image/jpeg', etc.
  file_size       INT,
  description     TEXT,           -- Why this evidence is relevant
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_dispute ON dispute_evidence (dispute_id);
CREATE INDEX IF NOT EXISTS idx_evidence_uploader ON dispute_evidence (uploader_role);

-- ─── 7. Add dispute_id column to transactions (foreign key) ─

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL;

-- ─── 8. Create trigger for disputes updated_at ──────────────────

CREATE TRIGGER IF NOT EXISTS trg_disputes_updated BEFORE UPDATE ON disputes
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 9. Function to auto-set dispute SLA deadline ────────

CREATE OR REPLACE FUNCTION set_dispute_sla()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := NOW() + INTERVAL '48 hours';  -- 48-hour SLA
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trg_set_dispute_sla BEFORE INSERT ON disputes
FOR EACH ROW EXECUTE FUNCTION set_dispute_sla();
