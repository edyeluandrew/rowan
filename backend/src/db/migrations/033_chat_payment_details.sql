-- Chat payment details cards and trader first-reply tracking

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS payload JSONB;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_first_trader_reply BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check
  CHECK (type IN ('text', 'image', 'system', 'payment_details'));

CREATE INDEX IF NOT EXISTS idx_chat_first_trader_reply
  ON chat_messages (transaction_id, is_first_trader_reply)
  WHERE sender_role = 'trader' AND is_first_trader_reply = TRUE;
