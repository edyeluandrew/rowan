-- Store verified MoMo phone numbers for P2P buy payouts (user pays trader).
-- Hash remains for dedup; plain number is needed to display payment instructions.

ALTER TABLE trader_momo_accounts
  ADD COLUMN IF NOT EXISTS phone_number TEXT;
