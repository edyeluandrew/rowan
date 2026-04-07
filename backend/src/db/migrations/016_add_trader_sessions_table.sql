-- Migration 016: Add trader sessions table for session management
-- Purpose: Track active trader sessions for security monitoring and revocation

CREATE TABLE IF NOT EXISTS trader_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  device_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

-- Index on trader_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_trader_sessions_trader_id 
  ON trader_sessions(trader_id);

-- Index on created_at for ordering/cleanup
CREATE INDEX IF NOT EXISTS idx_trader_sessions_created_at 
  ON trader_sessions(created_at);
