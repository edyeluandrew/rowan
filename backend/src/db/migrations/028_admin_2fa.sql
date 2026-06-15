-- Phase 2H-2: Admin two-factor authentication tables

CREATE TABLE IF NOT EXISTS admin_2fa_settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  totp_secret             TEXT NOT NULL,
  is_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_at              TIMESTAMPTZ,
  backup_codes_remaining  INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_2fa_settings_admin ON admin_2fa_settings (admin_id);

CREATE TABLE IF NOT EXISTS admin_2fa_verification_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_type   TEXT NOT NULL,
  result              TEXT NOT NULL,
  failure_reason      TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_2fa_logs_admin ON admin_2fa_verification_logs (admin_id, created_at DESC);

COMMENT ON TABLE admin_2fa_settings IS 'TOTP secrets stored encrypted (AES-256-GCM via ENCRYPTION_KEY).';
COMMENT ON COLUMN admin_2fa_settings.totp_secret IS 'Encrypted base32 TOTP secret; legacy plaintext upgraded on read.';
