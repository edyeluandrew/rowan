-- Post-completion appeal window

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS appeal_expires_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS appeal_archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_appeal_expires
  ON transactions (appeal_expires_at)
  WHERE state = 'COMPLETE' AND appeal_archived_at IS NULL;

COMMENT ON COLUMN transactions.appeal_expires_at IS 'Deadline to raise dispute after COMPLETE';
COMMENT ON COLUMN transactions.appeal_archived_at IS 'Set when appeal window closes permanently';
