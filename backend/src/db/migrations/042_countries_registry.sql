-- Phase 2 E1: Config-driven country registry (UG, KE, TZ, RW)

CREATE TABLE IF NOT EXISTS countries (
  code            CHAR(2) PRIMARY KEY,
  name            TEXT NOT NULL,
  currency_code   CHAR(3) NOT NULL,
  phone_prefix    TEXT NOT NULL,
  flag_emoji      TEXT,
  active          BOOLEAN NOT NULL DEFAULT true,
  kyc_config      JSONB NOT NULL DEFAULT '{}',
  payment_config  JSONB NOT NULL DEFAULT '{}',
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS country_payment_methods (
  id              SERIAL PRIMARY KEY,
  country_code    CHAR(2) NOT NULL REFERENCES countries(code) ON DELETE CASCADE,
  network_code    TEXT NOT NULL,
  label           TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'momo',
  active          BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, network_code)
);

CREATE INDEX IF NOT EXISTS idx_country_payment_methods_country
  ON country_payment_methods(country_code) WHERE active = true;

INSERT INTO countries (code, name, currency_code, phone_prefix, flag_emoji, sort_order, kyc_config, payment_config)
VALUES
  ('UG', 'Uganda', 'UGX', '+256', '🇺🇬', 1,
   '{"tier1_daily_usd":50,"tier2_daily_usd":1000}'::jsonb,
   '{"default_offramp_provider":"p2p_trader","fallback_provider":"yellow_pay"}'::jsonb),
  ('KE', 'Kenya', 'KES', '+254', '🇰🇪', 2,
   '{"tier1_daily_usd":50,"tier2_daily_usd":1000}'::jsonb,
   '{"default_offramp_provider":"p2p_trader","fallback_provider":"yellow_pay"}'::jsonb),
  ('TZ', 'Tanzania', 'TZS', '+255', '🇹🇿', 3,
   '{"tier1_daily_usd":50,"tier2_daily_usd":1000}'::jsonb,
   '{"default_offramp_provider":"p2p_trader","fallback_provider":"yellow_pay"}'::jsonb),
  ('RW', 'Rwanda', 'RWF', '+250', '🇷🇼', 4,
   '{"tier1_daily_usd":50,"tier2_daily_usd":1000}'::jsonb,
   '{"default_offramp_provider":"p2p_trader","fallback_provider":"yellow_pay"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  currency_code = EXCLUDED.currency_code,
  phone_prefix = EXCLUDED.phone_prefix,
  flag_emoji = EXCLUDED.flag_emoji,
  sort_order = EXCLUDED.sort_order,
  kyc_config = EXCLUDED.kyc_config,
  payment_config = EXCLUDED.payment_config,
  updated_at = NOW();

INSERT INTO country_payment_methods (country_code, network_code, label, provider, sort_order)
VALUES
  ('UG', 'MTN_UG', 'MTN MoMo', 'momo', 1),
  ('UG', 'AIRTEL_UG', 'Airtel Money', 'momo', 2),
  ('KE', 'MPESA_KE', 'M-Pesa', 'momo', 1),
  ('TZ', 'MTN_TZ', 'MTN', 'momo', 1),
  ('TZ', 'AIRTEL_TZ', 'Airtel', 'momo', 2),
  ('RW', 'MTN_RW', 'MTN MoMo', 'momo', 1),
  ('RW', 'AIRTEL_RW', 'Airtel Money', 'momo', 2)
ON CONFLICT (country_code, network_code) DO UPDATE SET
  label = EXCLUDED.label,
  provider = EXCLUDED.provider,
  sort_order = EXCLUDED.sort_order,
  active = true;
