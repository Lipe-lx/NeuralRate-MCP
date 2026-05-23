CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  owner_eoa TEXT NOT NULL UNIQUE,
  auth_strategy TEXT NOT NULL DEFAULT 'passkey-embedded',
  external_wallet TEXT,
  embedded_wallet TEXT,
  display_name TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'vault_pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_agent_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  owner_eoa TEXT NOT NULL,
  vault_id TEXT,
  objective TEXT NOT NULL DEFAULT 'income',
  risk_profile TEXT NOT NULL DEFAULT 'medium',
  horizon_hours INTEGER NOT NULL DEFAULT 24,
  automation_mode TEXT NOT NULL DEFAULT 'auto-within-limits',
  restriction_preset TEXT NOT NULL DEFAULT 'blue-chip-defi',
  allowed_assets_json TEXT NOT NULL DEFAULT '[]',
  denied_assets_json TEXT NOT NULL DEFAULT '[]',
  allowed_protocols_json TEXT NOT NULL DEFAULT '[]',
  denied_protocols_json TEXT NOT NULL DEFAULT '[]',
  max_protocol_weight_bps INTEGER NOT NULL DEFAULT 5000,
  max_asset_weight_bps INTEGER NOT NULL DEFAULT 5000,
  max_action_usd INTEGER NOT NULL DEFAULT 1000,
  max_daily_usd INTEGER NOT NULL DEFAULT 2500,
  max_automation_usd INTEGER NOT NULL DEFAULT 10000,
  max_slippage_bps INTEGER NOT NULL DEFAULT 50,
  rebalance_cadence_hours INTEGER NOT NULL DEFAULT 24,
  min_apy_bps INTEGER NOT NULL DEFAULT 0,
  min_spread_over_tbill_bps INTEGER NOT NULL DEFAULT 0,
  require_manual_above_usd INTEGER NOT NULL DEFAULT 2500,
  pause_on_risk_event INTEGER NOT NULL DEFAULT 1,
  policy_version TEXT NOT NULL DEFAULT 'vault-v1',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_vaults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  owner_eoa TEXT NOT NULL,
  vault_address TEXT,
  vault_kind TEXT NOT NULL DEFAULT 'dedicated-agent-vault',
  vault_provider TEXT NOT NULL DEFAULT 'safe',
  agent_scope_wallet TEXT,
  chain_id INTEGER NOT NULL DEFAULT 5003,
  status TEXT NOT NULL DEFAULT 'predicted',
  funding_status TEXT NOT NULL DEFAULT 'needs_funding',
  automation_status TEXT NOT NULL DEFAULT 'not_enabled',
  balance_usd TEXT NOT NULL DEFAULT '0',
  deposit_address TEXT,
  last_funding_intent_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vault_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  vault_id TEXT NOT NULL,
  owner_eoa TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'execution',
  status TEXT NOT NULL DEFAULT 'draft',
  allowed_contracts_json TEXT NOT NULL DEFAULT '[]',
  allowed_selectors_json TEXT NOT NULL DEFAULT '[]',
  allowed_assets_json TEXT NOT NULL DEFAULT '[]',
  allowed_protocols_json TEXT NOT NULL DEFAULT '[]',
  spend_token TEXT,
  spend_limit_per_use TEXT,
  spend_limit_daily TEXT,
  spend_limit_total TEXT,
  usage_limit INTEGER,
  valid_after TEXT,
  valid_until TEXT,
  human_summary TEXT,
  raw_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE decisions ADD COLUMN user_id TEXT;
ALTER TABLE decisions ADD COLUMN vault_id TEXT;
ALTER TABLE decisions ADD COLUMN policy_version TEXT;
ALTER TABLE decisions ADD COLUMN objective TEXT DEFAULT 'income';
ALTER TABLE decisions ADD COLUMN automation_mode TEXT DEFAULT 'recommend-only';
ALTER TABLE decisions ADD COLUMN applied_constraints_json TEXT;
ALTER TABLE decisions ADD COLUMN rationale_json TEXT;

ALTER TABLE automation_policies ADD COLUMN user_id TEXT;
ALTER TABLE automation_policies ADD COLUMN vault_id TEXT;
ALTER TABLE automation_policies ADD COLUMN allowed_assets_json TEXT DEFAULT '[]';
ALTER TABLE automation_policies ADD COLUMN allowed_protocols_json TEXT DEFAULT '[]';
ALTER TABLE automation_policies ADD COLUMN spend_limit_daily TEXT;

ALTER TABLE automation_sessions ADD COLUMN user_id TEXT;
ALTER TABLE automation_sessions ADD COLUMN vault_id TEXT;
ALTER TABLE automation_sessions ADD COLUMN policy_version TEXT;

ALTER TABLE automation_jobs ADD COLUMN user_id TEXT;
ALTER TABLE automation_jobs ADD COLUMN vault_id TEXT;
ALTER TABLE automation_jobs ADD COLUMN policy_version TEXT;

ALTER TABLE benchmark_jobs ADD COLUMN user_id TEXT;
ALTER TABLE benchmark_jobs ADD COLUMN vault_id TEXT;
ALTER TABLE benchmark_jobs ADD COLUMN policy_version TEXT;
