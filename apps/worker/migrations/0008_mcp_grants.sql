CREATE TABLE IF NOT EXISTS automation_grants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grant_id TEXT NOT NULL UNIQUE,
  owner_eoa TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  agent_subject TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  allowed_domains_json TEXT NOT NULL DEFAULT '[]',
  nonce TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,
  grant_message TEXT NOT NULL,
  issued_via TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  session_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_grants_owner ON automation_grants(owner_eoa);
CREATE INDEX IF NOT EXISTS idx_automation_grants_vault ON automation_grants(vault_id);
CREATE INDEX IF NOT EXISTS idx_automation_grants_status ON automation_grants(status);

CREATE TABLE IF NOT EXISTS mcp_mutation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  grant_id TEXT NOT NULL,
  owner_eoa TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  agent_subject TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  allowed_domains_json TEXT NOT NULL DEFAULT '[]',
  session_token_hash TEXT NOT NULL UNIQUE,
  issued_via TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mcp_sessions_owner ON mcp_mutation_sessions(owner_eoa);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_vault ON mcp_mutation_sessions(vault_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_status ON mcp_mutation_sessions(status);
