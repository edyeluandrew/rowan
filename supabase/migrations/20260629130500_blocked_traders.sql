-- User blocks on traders (marketplace + matching exclusion)

CREATE TABLE IF NOT EXISTS blocked_traders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trader_id   UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, trader_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_traders_user ON blocked_traders(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_traders_trader ON blocked_traders(trader_id);

COMMENT ON TABLE blocked_traders IS 'Wallet users who blocked specific traders';
