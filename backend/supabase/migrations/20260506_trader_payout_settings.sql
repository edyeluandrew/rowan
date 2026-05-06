-- ============================================================
-- Trader Payout Settings Table
-- Allows traders to configure payout networks with optional pricing
-- Date: 2026-05-06
-- ============================================================

-- ─── 1. Create trader_payout_settings table ──────────────────

CREATE TABLE IF NOT EXISTS trader_payout_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id         UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
  country           TEXT NOT NULL,                    -- e.g., 'Uganda', 'Kenya'
  network           mobile_network NOT NULL,         -- enum: MTN_UG, AIRTEL_UG, M_PESA_KE, etc.
  currency          TEXT NOT NULL,                   -- ISO 4217: UGX, KES, TZS
  min_amount        NUMERIC(18,2) NOT NULL,          -- minimum fiat payout
  max_amount        NUMERIC(18,2) NOT NULL,          -- maximum fiat payout
  available_float   NUMERIC(18,2) NOT NULL,          -- current available fiat for payouts
  reserved_float    NUMERIC(18,2) NOT NULL DEFAULT 0, -- fiat already reserved for active requests
  
  -- Optional pricing fields (for future matching logic)
  rate_per_usdc     NUMERIC(18,7),                   -- fiat amount per 1 USDC (e.g., 3760 UGX)
  spread_percent    NUMERIC(5,2),                    -- trader margin/spread preference (0-100%)
  fee_percent       NUMERIC(5,2),                    -- optional fee setting (0-100%)
  
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT chk_amounts CHECK (max_amount > min_amount AND min_amount >= 0),
  CONSTRAINT chk_float CHECK (available_float >= 0 AND reserved_float >= 0),
  CONSTRAINT chk_pricing CHECK (
    (rate_per_usdc IS NULL OR rate_per_usdc > 0) AND
    (spread_percent IS NULL OR (spread_percent >= 0 AND spread_percent <= 100)) AND
    (fee_percent IS NULL OR (fee_percent >= 0 AND fee_percent <= 100))
  ),
  -- One active setting per trader per network per currency
  UNIQUE(trader_id, network, currency)
);

-- ─── 2. Create indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payout_trader ON trader_payout_settings (trader_id);
CREATE INDEX IF NOT EXISTS idx_payout_active ON trader_payout_settings (trader_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payout_network ON trader_payout_settings (network, currency, is_active);

-- ─── 3. Enable RLS ──────────────────────────────────────────

ALTER TABLE trader_payout_settings ENABLE ROW LEVEL SECURITY;

-- Traders can view/insert/update/delete their own payout settings
DROP POLICY IF EXISTS "payout_settings_service_role" ON trader_payout_settings;
DROP POLICY IF EXISTS "payout_settings_trader_select" ON trader_payout_settings;
DROP POLICY IF EXISTS "payout_settings_trader_insert" ON trader_payout_settings;
DROP POLICY IF EXISTS "payout_settings_trader_update" ON trader_payout_settings;
DROP POLICY IF EXISTS "payout_settings_trader_delete" ON trader_payout_settings;

CREATE POLICY "payout_settings_service_role"
  ON trader_payout_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "payout_settings_trader_select"
  ON trader_payout_settings FOR SELECT
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "payout_settings_trader_insert"
  ON trader_payout_settings FOR INSERT
  WITH CHECK (trader_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "payout_settings_trader_update"
  ON trader_payout_settings FOR UPDATE
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (trader_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "payout_settings_trader_delete"
  ON trader_payout_settings FOR DELETE
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

-- ─── 4. Create trigger for updated_at ──────────────────────

CREATE TRIGGER trg_payout_settings_updated
  BEFORE UPDATE ON trader_payout_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. Add comment ────────────────────────────────────────

COMMENT ON TABLE trader_payout_settings IS 'Trader payout network configuration with optional pricing fields. Pricing fields (rate_per_usdc, spread_percent, fee_percent) are for future matching logic and currently not used.';
COMMENT ON COLUMN trader_payout_settings.available_float IS 'Fiat amount available for payouts (manually maintained by trader)';
COMMENT ON COLUMN trader_payout_settings.reserved_float IS 'Fiat amount reserved for active/pending requests (system-managed)';
COMMENT ON COLUMN trader_payout_settings.rate_per_usdc IS 'Optional: Trader''s preferred rate (fiat per 1 USDC). Not yet used in matching.';
COMMENT ON COLUMN trader_payout_settings.spread_percent IS 'Optional: Trader''s preferred spread/margin. Not yet used in matching.';
COMMENT ON COLUMN trader_payout_settings.fee_percent IS 'Optional: Trader''s fee preference. Not yet used in matching.';
