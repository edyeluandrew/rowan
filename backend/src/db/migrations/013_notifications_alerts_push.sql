-- Migration 013: Add notifications, rate_alerts, push_tokens tables
-- Required by the wallet app for persistent notifications, rate alerts, and push tokens

-- ── notifications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'info',           -- info, transaction, dispute, system
  title         TEXT NOT NULL,
  body          TEXT,
  data          JSONB DEFAULT '{}',                     -- flexible payload (tx_id, etc.)
  read_at       TIMESTAMPTZ,                            -- null = unread
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at DESC);

-- ── rate_alerts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pair          TEXT NOT NULL DEFAULT 'USDC/UGX',       -- e.g. USDC/UGX, USDC/KES
  direction     TEXT NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
  target_rate   NUMERIC(18,4) NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  triggered_at  TIMESTAMPTZ,                            -- set when alert fires
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_alerts_user_id ON rate_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_alerts_active ON rate_alerts(user_id, active) WHERE active = true;

-- ── push_tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'android',        -- android, ios, web
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
