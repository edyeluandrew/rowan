-- Payout proof columns + payment_proof chat message type

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_proof_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payout_reference TEXT;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check
  CHECK (type IN ('text', 'image', 'system', 'payment_details', 'payment_proof'));
