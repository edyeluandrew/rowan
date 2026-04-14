-- Migration 019: Add Two-Factor Authentication support for wallet users
-- Purpose: Enable 2FA for regular wallet users (SEP-10 auth)
-- Schema mirrors trader 2FA design but uses user_id instead of trader_id

-- 2FA Settings table for wallet users
CREATE TABLE IF NOT EXISTS user_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- TOTP secret (encrypted in application layer before storing)
  totp_secret TEXT,
  
  -- Whether 2FA is currently enabled
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- When 2FA was first enabled
  enabled_at TIMESTAMPTZ,
  
  -- Number of backup codes remaining
  backup_codes_remaining INT NOT NULL DEFAULT 10,
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_settings_user_id 
  ON user_2fa_settings(user_id);

-- Backup codes table for wallet users (per-code storage, same pattern as traders)
CREATE TABLE IF NOT EXISTS user_2fa_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_backup_codes_user_id 
  ON user_2fa_backup_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_user_2fa_backup_codes_used 
  ON user_2fa_backup_codes(user_id, used_at);

-- 2FA Verification Log for audit trail and rate limiting
CREATE TABLE IF NOT EXISTS user_2fa_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Type of verification: 'setup', 'login', 'disable', 'regenerate'
  verification_type VARCHAR(50) NOT NULL,
  
  -- Result: 'success' or 'failed'
  result VARCHAR(50) NOT NULL,
  
  -- Failure reason if applicable
  failure_reason TEXT,
  
  -- IP address for audit
  ip_address INET,
  
  -- User agent for audit
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_2fa_logs_user_id 
  ON user_2fa_verification_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_user_2fa_logs_created_at 
  ON user_2fa_verification_logs(created_at);
