-- ============================================================
-- ROWAN — Add admin auth columns to users table
-- Needed for email/password admin login (wallet users use Stellar signatures)
-- ============================================================

-- [F-4 FIX] Allow NULL stellar_address for admin accounts (email/password login)
ALTER TABLE users ALTER COLUMN stellar_address DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);
