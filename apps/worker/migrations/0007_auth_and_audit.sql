CREATE TABLE IF NOT EXISTS auth_nonces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_eoa TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  statement TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_owner_eoa ON auth_nonces(owner_eoa);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at ON auth_nonces(expires_at);

ALTER TABLE automation_sessions ADD COLUMN consent_digest TEXT;
ALTER TABLE automation_sessions ADD COLUMN consent_verified_at TEXT;

ALTER TABLE automation_jobs ADD COLUMN confirmed_at TEXT;

ALTER TABLE benchmark_jobs ADD COLUMN confirmed_at TEXT;
