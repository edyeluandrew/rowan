-- Phase 2G: Legacy testnet orphan recovery metadata (USDC sweep to recovery wallet — NOT user refund)
-- SELF-CONTAINED + IDEMPOTENT.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_recovery_tx TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_recovery_wallet TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_recovery_at TIMESTAMPTZ;

COMMENT ON COLUMN transactions.admin_recovery_tx IS
  'On-chain USDC sweep tx hash for legacy orphan admin recovery (not a user refund).';
COMMENT ON COLUMN transactions.admin_recovery_wallet IS
  'Destination Stellar address for admin_recovery_tx sweep.';
COMMENT ON COLUMN transactions.admin_recovery_at IS
  'When admin orphan recovery sweep completed.';
