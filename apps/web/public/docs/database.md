# Database Schema

**Status:** Canonical doc

NeuralRate stores persistent state in Cloudflare D1. This document reflects the migrations present in `apps/worker/migrations/0001_initial.sql` through `0009_telemetry.sql`.

## Migration Set

- `0001_initial.sql`
- `0002_benchmark_status.sql`
- `0003_automation_foundation.sql`
- `0004_user_vault_personalization.sql`
- `0005_live_provider_refs.sql`
- `0006_vault_ownership_ack.sql`
- `0007_auth_and_audit.sql`
- `0008_mcp_grants.sql`
- `0009_telemetry.sql`

## Table Inventory

Current tables created by migrations:

- `decisions`
- `user_accounts`
- `automation_policies`
- `automation_sessions`
- `automation_jobs`
- `benchmark_jobs`
- `user_profiles`
- `user_agent_configs`
- `user_vaults`
- `vault_permissions`
- `auth_nonces`
- `automation_grants`
- `mcp_mutation_sessions`
- `telemetry_events`

## Core Tables

### `decisions`

Primary decision ledger used by the MCP tools and the benchmark flow.

Key columns:

- identity and provenance
  - `decision_id`
  - `agent_address`
  - `requested_by`
  - `data_snapshot_hash`
- predicted and realized metrics
  - `predicted_apy_bps`
  - `risk_adjusted_apy_bps`
  - `benchmark_rate_bps`
  - `realized_apy_bps`
  - `prediction_error_bps`
  - `outperformance_bps`
- recommendation metadata
  - `risk_profile`
  - `allocation_json`
  - `settlement_horizon_hours`
  - `settlement_due_at`
  - `objective`
  - `automation_mode`
  - `applied_constraints_json`
  - `rationale_json`
- benchmark and automation linkage
  - `benchmark_status`
  - `tx_hash`
  - `onchain_decision_id`
  - `settlement_tx_hash`
  - `automation_session_id`
  - `benchmark_job_id`
  - `user_id`
  - `vault_id`
  - `policy_version`
- timestamps
  - `created_at`
  - `settled_at`

### `user_profiles`

User identity and onboarding state.

Key columns:

- `user_id`
- `owner_eoa`
- `auth_strategy`
- `external_wallet`
- `embedded_wallet`
- `display_name`
- `onboarding_status`
- `privy_user_id`
- `provider_user_ref`
- `wallet_provider`

### `user_agent_configs`

Stored user policy defaults and limits.

Key columns:

- identity
  - `user_id`
  - `owner_eoa`
  - `vault_id`
- policy fields
  - `objective`
  - `risk_profile`
  - `horizon_hours`
  - `automation_mode`
  - `restriction_preset`
- lists
  - `allowed_assets_json`
  - `denied_assets_json`
  - `allowed_protocols_json`
  - `denied_protocols_json`
- limits
  - `max_protocol_weight_bps`
  - `max_asset_weight_bps`
  - `max_action_usd`
  - `max_daily_usd`
  - `max_automation_usd`
  - `max_slippage_bps`
  - `rebalance_cadence_hours`
  - `min_apy_bps`
  - `min_spread_over_tbill_bps`
  - `require_manual_above_usd`
  - `pause_on_risk_event`
  - `authorization_ttl_hours` (1-8640 hours; defaults to 12; UI/MCP may express it as hours, days, and 30-day months)
- versioning
  - `policy_version`

### `user_vaults`

Per-user vault state. The code treats this as the main vault record exposed to the frontend.

Key columns:

- `vault_id`
- `user_id`
- `owner_eoa`
- `vault_address`
- `vault_kind`
- `vault_provider`
- `agent_scope_wallet`
- `chain_id`
- `status`
- `funding_status`
- `automation_status`
- `balance_usd`
- `deposit_address`
- `last_funding_intent_json`
- `safe_deployment_status`
- `safe_salt_nonce`
- `provider_vault_ref`
- `safe_vault_address`
- `ownership_acknowledged_at`

### `vault_permissions`

Human-readable and machine-readable execution boundaries for a vault.

Key columns:

- identity
  - `permission_id`
  - `user_id`
  - `vault_id`
  - `owner_eoa`
  - `scope`
  - `status`
- policy content
  - `allowed_contracts_json`
  - `allowed_selectors_json`
  - `allowed_assets_json`
  - `allowed_protocols_json`
  - `spend_token`
  - `spend_limit_per_use`
  - `spend_limit_daily`
  - `spend_limit_total`
  - `usage_limit`
  - `valid_after`
  - `valid_until`
  - `human_summary`
  - `raw_policy_json`
- provider references
  - `provider_permission_ref`
  - `turnkey_signer_ref`

## Automation Tables

### `automation_policies`

Executor-facing policy records stored by the worker.

Key columns:

- `policy_id`
- `owner_eoa`
- `user_smart_account`
- `chain_id`
- `policy_version`
- `domain`
- `status`
- `allowed_contracts_json`
- `allowed_selectors_json`
- `allowed_assets_json`
- `allowed_protocols_json`
- `spend_token`
- `spend_limit_per_use`
- `spend_limit_daily`
- `spend_limit_total`
- `usage_limit`
- `valid_after`
- `valid_until`
- `human_summary`
- `raw_policy_json`
- `user_id`
- `vault_id`

### `automation_sessions`

Worker-side record of automation activation state.

Key columns:

- identity and scope
  - `session_id`
  - `policy_id`
  - `owner_eoa`
  - `user_smart_account`
  - `agent_session_signer`
  - `chain_id`
  - `user_id`
  - `vault_id`
  - `policy_version`
- status and validity
  - `session_status`
  - `valid_after`
  - `valid_until`
  - `revoked_at`
- linkage and provider refs
  - `grant_tx_hash`
  - `revoke_tx_hash`
  - `permission_id`
  - `provider_session_ref`
  - `provider_permission_ref`
  - `turnkey_signer_ref`
- stored consent fields
  - `consent_message`
  - `consent_signature`
  - `consent_digest`
  - `consent_verified_at`
  - `session_details_json`

### `automation_jobs`

Execution job queue and receipts.

Key columns:

- `job_id`
- `session_id`
- `owner_eoa`
- `user_smart_account`
- `execution_domain`
- `job_type`
- `target_contract`
- `target_selector`
- `payload_json`
- `status`
- `tx_hash`
- `confirmed_at`
- `failure_reason`
- `provider_job_ref`
- `user_id`
- `vault_id`
- `policy_version`

### `benchmark_jobs`

Benchmark-specific queue and receipts.

Key columns:

- `benchmark_job_id`
- `decision_id`
- `owner_eoa`
- `agent_smart_wallet`
- `session_id`
- `status`
- `tx_hash`
- `onchain_decision_id`
- `confirmed_at`
- `data_snapshot_hash`
- `payload_json`
- `failure_reason`
- `provider_job_ref`
- `user_id`
- `vault_id`
- `policy_version`

## Auth and MCP Grant Tables

### `auth_nonces`

Single-use nonce envelopes for signed owner actions.

Columns:

- `owner_eoa`
- `nonce`
- `statement`
- `issued_at`
- `expires_at`
- `used_at`

### `automation_grants`

Canonical owner-signed automation grants.

Columns:

- `grant_id`
- `owner_eoa`
- `user_id`
- `vault_id`
- `vault_address`
- `agent_subject`
- `policy_version`
- `allowed_domains_json`
- `nonce`
- `signature`
- `grant_message`
- `issued_via`
- `status`
- `issued_at`
- `expires_at`
- `revoked_at`
- `session_id`

### `mcp_mutation_sessions`

Short-lived mutation sessions derived from an automation grant.

Columns:

- `session_id`
- `grant_id`
- `owner_eoa`
- `user_id`
- `vault_id`
- `vault_address`
- `agent_subject`
- `policy_version`
- `allowed_domains_json`
- `session_token_hash`
- `issued_via`
- `status`
- `issued_at`
- `expires_at`
- `last_used_at`
- `revoked_at`

## Telemetry Table

### `telemetry_events`

Logs application errors and events dispatched by the frontend or worker runtime.

Columns:

- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `event_id` (TEXT UNIQUE NOT NULL)
- `source` (TEXT NOT NULL)
- `level` (TEXT NOT NULL)
- `message` (TEXT NOT NULL)
- `route` (TEXT)
- `metadata_json` (TEXT)
- `created_at` (TEXT DEFAULT (datetime('now')))

Indexes:
- `idx_telemetry_events_created_at` on `created_at`
- `idx_telemetry_events_source` on `source`

## Compatibility Table

### `user_accounts`

Legacy account mapping retained by the worker.

Columns:

- `owner_eoa`
- `user_smart_account`
- `chain_id`
- `account_provider`
- `account_kind`
- `deployment_status`

## Durable Object Class Migration History

Cloudflare wrangler migrations tracked in `wrangler.toml` for the Durable Object state classes:

- **Tag `v1`**:
  - Registered DO class: `StableSyncMcpAgent`
- **Tag `v2`**:
  - Renamed DO class: `StableSyncMcpAgent` -> `NeuralRateMcpAgent`
- **Tag `v3`**:
  - Registered DO classes: `NeuralRateReadonlyMcpAgent`, `NeuralRateConfigMcpAgent`, `NeuralRateBenchmarkMcpAgent`, `NeuralRateExecutionMcpAgent`

## Frontend-Visible State

The worker normalizes these records into the `AutomationState` returned to the frontend. The top-level shape includes:

- profile and config
- current vault
- permissions
- automation sessions
- automation grants
- MCP mutation sessions
- benchmark jobs
- automation jobs
- an `automationReady` boolean

The TypeScript source of truth for that shape is `apps/web/src/lib/userState.ts`.
