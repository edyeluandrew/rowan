-- Migration 037: Trader payment proof on transactions + payment_proof chat type

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_proof_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_reference TEXT;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check
  CHECK (type IN ('text', 'image', 'system', 'payment_details', 'payment_proof'));

COMMENT ON COLUMN transactions.payout_proof_url IS 'Storage key or URL for trader mobile money payment proof screenshot';
