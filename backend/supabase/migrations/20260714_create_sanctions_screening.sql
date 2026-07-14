-- Sanctions / PEP screening: a local list of blocked entities (OFAC SDN + internal)
-- and an audit trail of every screen we run. Hits hard-block the action and raise
-- a fraud_alert for ops review.

CREATE TABLE IF NOT EXISTS sanctioned_entities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL DEFAULT 'INTERNAL',   -- OFAC_SDN | UN | EU | UK | INTERNAL
  external_id     TEXT,                                -- provider's id (e.g. OFAC uid)
  entity_type     TEXT NOT NULL DEFAULT 'INDIVIDUAL',  -- INDIVIDUAL | ENTITY | VESSEL
  full_name       TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  programs        TEXT[] NOT NULL DEFAULT '{}',        -- sanctions programs
  countries       TEXT[] NOT NULL DEFAULT '{}',
  dob             TEXT,                                -- free-form (lists vary)
  remarks         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  added_by        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanctions_norm    ON sanctioned_entities (normalized_name);
CREATE INDEX IF NOT EXISTS idx_sanctions_source  ON sanctioned_entities (source);
CREATE INDEX IF NOT EXISTS idx_sanctions_active  ON sanctioned_entities (is_active) WHERE is_active = TRUE;
-- Dedup provider imports (source + external_id) without breaking manual rows (external_id NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sanctions_src_ext
  ON sanctioned_entities (source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS screening_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type     TEXT NOT NULL,             -- KYC | PAYOUT | MANUAL | COUNTERPARTY
  subject_ref      TEXT,                       -- submission id / transaction id / quote id
  user_id          UUID REFERENCES users(id),
  query_name       TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  query_dob        TEXT,
  query_country    TEXT,
  result           TEXT NOT NULL,              -- CLEAR | HIT
  top_score        NUMERIC(5,4) NOT NULL DEFAULT 0,
  matched_entity_id UUID REFERENCES sanctioned_entities(id),
  matched_name     TEXT,
  matched_source   TEXT,
  decision         TEXT,                       -- BLOCKED | CLEARED | OVERRIDDEN
  decided_by       UUID REFERENCES users(id),
  override_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_screening_result     ON screening_checks (result);
CREATE INDEX IF NOT EXISTS idx_screening_created_at ON screening_checks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screening_subject    ON screening_checks (subject_type, subject_ref);

ALTER TABLE sanctioned_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_checks    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sanctioned_entities_service_role_access" ON sanctioned_entities;
CREATE POLICY "sanctioned_entities_service_role_access" ON sanctioned_entities
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "screening_checks_service_role_access" ON screening_checks;
CREATE POLICY "screening_checks_service_role_access" ON screening_checks
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
