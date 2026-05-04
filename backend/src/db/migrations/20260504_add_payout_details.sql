-- Migration: Add payout details to quotes and transactions
-- Adds payout_phone and payout_name to support trader request flow
-- Date: 2026-05-04

-- Add payout_phone and payout_name to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payout_phone TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payout_name TEXT;

-- Add payout_phone and payout_name to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_phone TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_payout ON transactions(payout_phone);
