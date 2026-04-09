-- Migration 017: Add Two-Factor Authentication support
-- Purpose: Store 2FA secrets, backup codes, and verification audit trail

-- 2FA Settings table
CREATE TABLE IF NOT EXISTS trader_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL UNIQUE REFERENCES traders(id) ON DELETE CASCADE,
  
  -- TOTP secret (encrypted in application layer before storing)
  totp_secret TEXT,
  
  -- Whether 2FA is currently enabled
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- When 2FA was first enabled
  enabled_at TIMESTAMPTZ,
  
  -- Backup codes (hashed, one per row is stored as newline-separated in a single text field)
  -- Or we use a separate table - storing here as JSON for simplicity
  backup_codes_hash TEXT,
  
  -- Number of backup codes remaining
  backup_codes_remaining INT NOT NULL DEFAULT 10,
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trader_2fa_settings_trader_id 
  ON trader_2fa_settings(trader_id);

-- 2FA Verification Log for audit trail and rate limiting
CREATE TABLE IF NOT EXISTS trader_2fa_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  
  -- Type of verification: 'setup', 'login', 'disable'
  verification_type VARCHAR(50) NOT NULL,
  
  -- Result: 'success' or 'failed'
  result VARCHAR(50) NOT NULL,
  
  -- Failure reason if applicable
  failure_reason TEXT,
  
  -- IP address for audit
  ip_address INET,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trader_2fa_logs_trader_id 
  ON trader_2fa_verification_logs(trader_id);
  
CREATE INDEX IF NOT EXISTS idx_trader_2fa_logs_created_at 
  ON trader_2fa_verification_logs(created_at);
