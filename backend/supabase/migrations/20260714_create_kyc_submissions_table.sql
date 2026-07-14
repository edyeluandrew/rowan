-- KYC upgrade flow: users submit identity documents to move from NONE -> BASIC/VERIFIED.
-- Admin reviews each submission and, on approval, the user's kyc_level and
-- daily_limit_ugx are raised. Previously every user was permanently stuck at NONE.

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  requested_level    kyc_level NOT NULL,
  full_name          TEXT NOT NULL,
  date_of_birth      DATE,
  document_type      TEXT NOT NULL,             -- NATIONAL_ID | PASSPORT | DRIVERS_LICENSE
  document_number    TEXT NOT NULL,
  document_country   TEXT,
  document_front_url TEXT,
  document_back_url  TEXT,
  selfie_url         TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  review_notes       TEXT,
  reviewed_by        UUID REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user       ON kyc_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status     ON kyc_submissions (status);
CREATE INDEX IF NOT EXISTS idx_kyc_created_at ON kyc_submissions (created_at DESC);

-- Only one pending submission per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_one_pending
  ON kyc_submissions (user_id) WHERE status = 'PENDING';

ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc_submissions_service_role_access" ON kyc_submissions;
CREATE POLICY "kyc_submissions_service_role_access" ON kyc_submissions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
