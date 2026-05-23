ALTER TABLE decisions ADD COLUMN automation_session_id TEXT;
ALTER TABLE decisions ADD COLUMN benchmark_job_id TEXT;

CREATE TABLE IF NOT EXISTS user_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_eoa TEXT NOT NULL UNIQUE,
  user_smart_account TEXT,
  chain_id INTEGER NOT NULL DEFAULT 5003,
  account_provider TEXT NOT NULL DEFAULT 'biconomy-nexus',
  account_kind TEXT NOT NULL DEFAULT 'user-smart-account',
  deployment_status TEXT NOT NULL DEFAULT 'predicted',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id TEXT NOT NULL UNIQUE,
  owner_eoa TEXT NOT NULL,
  user_smart_account TEXT,
  chain_id INTEGER NOT NULL DEFAULT 5003,
  policy_version TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  allowed_contracts_json TEXT NOT NULL DEFAULT '[]',
  allowed_selectors_json TEXT NOT NULL DEFAULT '[]',
  spend_token TEXT,
  spend_limit_per_use TEXT,
  spend_limit_total TEXT,
  usage_limit INTEGER,
  valid_after TEXT,
  valid_until TEXT,
  human_summary TEXT,
  raw_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  policy_id TEXT NOT NULL,
  owner_eoa TEXT NOT NULL,
  user_smart_account TEXT,
  agent_session_signer TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 5003,
  session_status TEXT NOT NULL DEFAULT 'pending_user',
  grant_tx_hash TEXT,
  revoke_tx_hash TEXT,
  permission_id TEXT,
  session_details_json TEXT,
  valid_after TEXT,
  valid_until TEXT,
  revoked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL UNIQUE,
  session_id TEXT,
  owner_eoa TEXT,
  user_smart_account TEXT,
  execution_domain TEXT NOT NULL DEFAULT 'execution',
  job_type TEXT NOT NULL,
  target_contract TEXT,
  target_selector TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  tx_hash TEXT,
  failure_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS benchmark_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  benchmark_job_id TEXT NOT NULL UNIQUE,
  decision_id TEXT NOT NULL,
  owner_eoa TEXT,
  agent_smart_wallet TEXT,
  session_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  tx_hash TEXT,
  onchain_decision_id TEXT,
  data_snapshot_hash TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  failure_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
