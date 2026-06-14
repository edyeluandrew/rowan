-- ============================================================
-- ROWAN — Migrate rows off obsolete transaction states
--
-- Phase 1 stabilization (P0.1 / P0.3):
-- The legacy state FIAT_SENT and the never-used DISPUTED_REFUNDED /
-- DISPUTED_RELEASED labels are no longer part of the application state
-- machine. PostgreSQL cannot DROP enum values, so we leave the labels in
-- place (harmless) but migrate any existing rows onto the canonical states.
--
-- This MUST be a separate migration from 021 because PostgreSQL forbids
-- using a newly added enum value (FIAT_PAYOUT_SUBMITTED) in the same
-- transaction that added it.
--
-- On a fresh database these UPDATEs simply affect zero rows.
-- ============================================================

-- Legacy "trader sent fiat" → canonical "payout submitted, awaiting user confirmation"
UPDATE transactions
   SET state = 'FIAT_PAYOUT_SUBMITTED',
       fiat_payout_submitted_at = COALESCE(fiat_payout_submitted_at, fiat_sent_at, NOW())
 WHERE state = 'FIAT_SENT';

-- Legacy dispute terminal labels → canonical terminal states
UPDATE transactions
   SET state = 'REFUNDED'
 WHERE state = 'DISPUTED_REFUNDED';

UPDATE transactions
   SET state = 'COMPLETE'
 WHERE state = 'DISPUTED_RELEASED';
