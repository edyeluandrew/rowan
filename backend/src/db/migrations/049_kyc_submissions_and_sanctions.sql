-- KYC submissions + sanctions screening (AML).
-- Previously only in supabase/migrations; required for /user/kyc and cashout quote screening.

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  requested_level    kyc_level NOT NULL,
  full_name          TEXT NOT NULL,
  date_of_birth      DATE,
  document_type      TEXT NOT NULL,
  document_number    TEXT NOT NULL,
  document_country   TEXT,
  document_front_url TEXT,
  document_back_url  TEXT,
  selfie_url         TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING',
  review_notes       TEXT,
  reviewed_by        UUID REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_user       ON kyc_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status     ON kyc_submissions (status);
CREATE INDEX IF NOT EXISTS idx_kyc_created_at ON kyc_submissions (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_one_pending
  ON kyc_submissions (user_id) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS sanctioned_entities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL DEFAULT 'INTERNAL',
  external_id     TEXT,
  entity_type     TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  full_name       TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  programs        TEXT[] NOT NULL DEFAULT '{}',
  countries       TEXT[] NOT NULL DEFAULT '{}',
  dob             TEXT,
  remarks         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  added_by        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanctions_norm    ON sanctioned_entities (normalized_name);
CREATE INDEX IF NOT EXISTS idx_sanctions_source  ON sanctioned_entities (source);
CREATE INDEX IF NOT EXISTS idx_sanctions_active  ON sanctioned_entities (is_active) WHERE is_active = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sanctions_src_ext
  ON sanctioned_entities (source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS screening_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type      TEXT NOT NULL,
  subject_ref       TEXT,
  user_id           UUID REFERENCES users(id),
  query_name        TEXT NOT NULL,
  normalized_query  TEXT NOT NULL,
  query_dob         TEXT,
  query_country     TEXT,
  result            TEXT NOT NULL,
  top_score         NUMERIC(5,4) NOT NULL DEFAULT 0,
  matched_entity_id UUID REFERENCES sanctioned_entities(id),
  matched_name      TEXT,
  matched_source    TEXT,
  decision          TEXT,
  decided_by        UUID REFERENCES users(id),
  override_reason   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_result     ON screening_checks (result);
CREATE INDEX IF NOT EXISTS idx_screening_created_at ON screening_checks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screening_subject    ON screening_checks (subject_type, subject_ref);
