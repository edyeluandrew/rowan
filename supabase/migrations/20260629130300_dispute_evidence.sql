-- Dispute evidence uploads (separate from order chat)

CREATE TABLE IF NOT EXISTS dispute_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id      UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  uploader_id     UUID NOT NULL,
  uploader_role   TEXT NOT NULL CHECK (uploader_role IN ('user', 'trader')),
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute ON dispute_evidence(dispute_id);

COMMENT ON TABLE dispute_evidence IS 'Evidence files attached to disputes by user or trader';
