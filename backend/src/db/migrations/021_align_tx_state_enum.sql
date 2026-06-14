-- ============================================================
-- ROWAN — Align tx_state enum + columns with the application state machine
--
-- Phase 1 stabilization (P0.1):
-- The code state machine (services/transactionStateMachine.js) uses
-- FIAT_PAYOUT_SUBMITTED, USER_CONFIRMATION_PENDING and RELEASE_BLOCKED,
-- but the auto-run migrations never added them (they only lived in the
-- separate backend/supabase/migrations tree that server.js does NOT run).
-- Migration 015 also recreated the enum WITHOUT RELEASE_BLOCKED.
--
-- This migration makes a fresh database able to run the app without enum
-- errors. It is idempotent and safe to run on existing databases.
--
-- NOTE: enum value additions are intentionally kept in THIS migration and
-- the obsolete-state data migration lives in 022_*.sql, because PostgreSQL
-- forbids using a newly added enum value in the same transaction.
-- ============================================================

-- ─── 1. Add the missing canonical states ────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FIAT_PAYOUT_SUBMITTED' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'FIAT_PAYOUT_SUBMITTED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'USER_CONFIRMATION_PENDING' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'USER_CONFIRMATION_PENDING';
  END IF;
END $$;

-- RELEASE_BLOCKED was added in 010 but dropped when 015 recreated the enum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RELEASE_BLOCKED' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'RELEASE_BLOCKED';
  END IF;
END $$;

-- Dispute states (defensive — normally added by 015; guarded for safety).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTE_OPENED' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'DISPUTE_OPENED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTE_REFUND_PENDING' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'DISPUTE_REFUND_PENDING';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DISPUTE_RELEASE_PENDING' AND enumtypid = 'tx_state'::regtype) THEN
    ALTER TYPE tx_state ADD VALUE 'DISPUTE_RELEASE_PENDING';
  END IF;
END $$;

-- ─── 2. Columns the state machine / routes read & write ─────
-- These existed only in backend/supabase/migrations; add them to the
-- auto-run schema so a fresh DB has them.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fiat_payout_submitted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_confirmation_pending_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_confirmed_receipt_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_reference TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_started_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_refund_tx TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_release_tx TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS dispute_id UUID REFERENCES disputes(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS release_error TEXT;

-- ─── 3. Indexes for the new live states ─────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_fiat_payout_submitted
  ON transactions (state) WHERE state = 'FIAT_PAYOUT_SUBMITTED';

CREATE INDEX IF NOT EXISTS idx_transactions_user_confirmation_pending
  ON transactions (state) WHERE state = 'USER_CONFIRMATION_PENDING';

CREATE INDEX IF NOT EXISTS idx_transactions_dispute_id
  ON transactions (dispute_id) WHERE dispute_id IS NOT NULL;

-- ─── 4. Column documentation (manual payout + reference model) ──

COMMENT ON COLUMN transactions.payout_reference IS 'Mobile money reference entered manually by the verified partner after they send fiat (MTN/Airtel/M-Pesa). MVP payout model is manual send + reference; no payment-rail API.';
COMMENT ON COLUMN transactions.fiat_payout_submitted_at IS 'Timestamp when partner submitted the manual mobile money reference';
COMMENT ON COLUMN transactions.user_confirmation_pending_at IS 'Timestamp when user began receipt confirmation';
COMMENT ON COLUMN transactions.user_confirmed_receipt_at IS 'Timestamp when user confirmed receipt of mobile money';
