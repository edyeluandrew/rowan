-- Create fraud_alerts table so fraudMonitor signals are persisted and
-- surfaced in the admin dashboard (GET /api/v1/admin/fraud-alerts).
-- Previously this table was only defined in the legacy src/db/migrations
-- path and never applied, so alert inserts were silently failing.

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  trader_id       UUID REFERENCES traders(id),
  alert_type      TEXT NOT NULL,
  details         TEXT,
  severity        TEXT NOT NULL DEFAULT 'MEDIUM',
  acknowledged    BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fa_type       ON fraud_alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_fa_severity   ON fraud_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_fa_created_at ON fraud_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fa_unack      ON fraud_alerts (acknowledged) WHERE acknowledged = FALSE;

-- Enable Row-Level Security (backend uses the service role)
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_alerts_service_role_access" ON fraud_alerts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
