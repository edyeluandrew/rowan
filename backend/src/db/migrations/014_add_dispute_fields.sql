-- Add extended dispute tracking and resolution fields
-- Supports full dispute workflow: OPEN → TRADER_RESPONDED → UNDER_REVIEW → RESOLVED/ESCALATED/DISMISSED

-- 1. Update dispute_status enum
-- Drop the default constraint first
ALTER TABLE disputes ALTER COLUMN status DROP DEFAULT;

-- Rename old enum and create new one
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

-- Cast column to new enum type
ALTER TABLE disputes 
  ALTER COLUMN status TYPE dispute_status USING status::text::dispute_status;

-- Re-add the default constraint
ALTER TABLE disputes ALTER COLUMN status SET DEFAULT 'OPEN';

DROP TYPE dispute_status_old;

-- 2. Add missing columns
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trader_response TEXT,
  ADD COLUMN IF NOT EXISTS trader_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trader_proof_key TEXT,
  ADD COLUMN IF NOT EXISTS escalated_by UUID,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
  ADD COLUMN IF NOT EXISTS closure_reason TEXT;

-- 3. Add dispute_id tracking to transactions table
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL;

-- 4. Create index for SLA monitoring (disputes approaching deadline)
CREATE INDEX IF NOT EXISTS idx_disputes_sla 
  ON disputes(sla_deadline) 
  WHERE status NOT IN ('RESOLVED_FOR_USER', 'RESOLVED_FOR_TRADER', 'DISMISSED', 'CLOSED');

-- 5. Create index for tracking escalated disputes
CREATE INDEX IF NOT EXISTS idx_disputes_escalated 
  ON disputes(status) 
  WHERE status = 'ESCALATED';
