-- Migration 038: Extend notifications for P2P order events

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'user'
  CHECK (user_role IN ('user', 'trader'));

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tx ON notifications(transaction_id) WHERE transaction_id IS NOT NULL;

-- Trader in-app notifications (traders are not in users table)
CREATE TABLE IF NOT EXISTS trader_inapp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  transaction_id UUID REFERENCES transactions(id),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trader_inapp_notifications ON trader_inapp_notifications(trader_id, created_at DESC);
