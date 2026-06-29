-- P2P: order chat, reviews, optional trader-ad selection, payment window
-- Mirror of backend/src/db/migrations/030_p2p_chat_reviews_trader_choice.sql

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('user', 'trader', 'system')),
  sender_id       UUID,
  message         TEXT,
  type            TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'system')),
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_transaction
  ON chat_messages (transaction_id, created_at ASC);

CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL,
  reviewer_role   TEXT NOT NULL CHECK (reviewer_role IN ('user', 'trader')),
  reviewee_id     UUID NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating IN (1, -1)),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id, reviewer_role)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee
  ON reviews (reviewee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_transaction
  ON reviews (transaction_id);

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS preferred_payout_setting_id UUID
    REFERENCES trader_payout_settings(id) ON DELETE SET NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS preferred_payout_setting_id UUID
    REFERENCES trader_payout_settings(id) ON DELETE SET NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_expires
  ON transactions (payment_expires_at)
  WHERE state = 'TRADER_MATCHED' AND payment_expires_at IS NOT NULL;
