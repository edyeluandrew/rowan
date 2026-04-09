-- ============================================================
-- Two-Factor Authentication Table
-- Stores TOTP secrets and backup codes for traders
-- ============================================================

-- ─── 1. Create traders_2fa table ────────────────────────

CREATE TABLE IF NOT EXISTS traders_2fa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id       UUID NOT NULL UNIQUE REFERENCES traders(id) ON DELETE CASCADE,
  secret          TEXT NOT NULL,
  backup_codes    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 2. Enable RLS ──────────────────────────────────────

ALTER TABLE traders_2fa ENABLE ROW LEVEL SECURITY;

-- Traders can view their own 2FA settings
CREATE POLICY "Traders can view their own 2FA"
  ON traders_2fa FOR SELECT
  USING (trader_id = (SELECT id FROM traders WHERE user_id = auth.uid() LIMIT 1));

-- Traders can update their own 2FA settings
CREATE POLICY "Traders can update their own 2FA"
  ON traders_2fa FOR UPDATE
  USING (trader_id = (SELECT id FROM traders WHERE user_id = auth.uid() LIMIT 1));

-- ─── 3. Create indexes ──────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_traders_2fa_trader_id ON traders_2fa (trader_id);
CREATE INDEX IF NOT EXISTS idx_traders_2fa_enabled ON traders_2fa (enabled);

-- ─── 4. Create audit trigger ────────────────────────────

CREATE TRIGGER update_traders_2fa_timestamp
  BEFORE UPDATE ON traders_2fa
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
