-- Trader online / last seen tracking

ALTER TABLE traders ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_traders_last_seen ON traders (last_seen_at DESC)
  WHERE status = 'ACTIVE';

COMMENT ON COLUMN traders.last_seen_at IS 'Updated on trader WebSocket connect/disconnect';
