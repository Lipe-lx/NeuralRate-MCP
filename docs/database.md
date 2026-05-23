# D1 Database Schema

To maintain persistent, verifiable, and historical decision-making logs for both the operator-facing benchmark terminal and autonomous agents, NeuralRate MCP utilizes **Cloudflare D1**, a native serverless SQLite database. D1 stores the local recommendation record first, then tracks which **user vault** and **policy version** produced that record, and finally records whether it has been benchmarked on Mantle Sepolia.

---

## 📋 Database Specifications

* **Binding Name:** `DECISIONS_DB`
* **Local Location:** `.wrangler/state/v3/d1`
* **Database Name:** `neuralrate-decisions`
* **Primary Tables:** `decisions`, `user_profiles`, `user_agent_configs`, `user_vaults`, `vault_permissions`, `user_accounts`, `automation_policies`, `automation_sessions`, `automation_jobs`, `benchmark_jobs`

---

## 🗄️ Table Schema: `decisions`

The `decisions` table maps all fields required to perform auditing and tracking for autonomous yields:

| Column Name | SQL Data Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Auto-incrementing internal unique sequence ID. |
| `decision_id` | `TEXT` | `UNIQUE NOT NULL` | Structured unique decision identifier (e.g. `dec_<uuid>`). |
| `agent_address` | `TEXT` | `NOT NULL` | The public address of the AI Agent node committing the decision. |
| `requested_by` | `TEXT` | `DEFAULT '0x0'` | The public address of the end user or smart contract requesting the allocation. |
| `data_snapshot_hash` | `TEXT` | - | IPFS or content hash of the yields data snapshot used for evaluation. |
| `predicted_apy_bps` | `INTEGER` | `NOT NULL` | The expected blended yield rate computed by the agent in basis points (1% = 100 bps). |
| `risk_adjusted_apy_bps` | `INTEGER` | - | The yield rate adjusted by our 6-factor risk penalty in basis points. |
| `benchmark_rate_bps` | `INTEGER` | - | The US 3-Month Treasury Bill rate fetched from FRED at decision time, in basis points. |
| `risk_profile` | `TEXT` | `DEFAULT 'conservative'` | Investor risk preference: `"low"`, `"medium"`, or `"high"`. |
| `allocation_json` | `TEXT` | - | JSON string of the exact distributed assets, protocols, and weights. |
| `settlement_horizon_hours`| `INTEGER` | `DEFAULT 24` | The horizon period in hours before evaluating APY accuracy on-chain. |
| `settlement_due_at` | `TEXT` | - | ISO string date indicating the scheduled time of maturity. |
| `realized_apy_bps` | `INTEGER` | - | The actual blended yield rate evaluated at maturity, in basis points. |
| `prediction_error_bps` | `INTEGER` | - | Difference between realized and predicted APY: $\text{realized} - \text{predicted}$. |
| `outperformance_bps` | `INTEGER` | - | Blended yield outperformance over US T-Bills in basis points: $\text{realized} - \text{tbill}$. |
| `is_settled` | `INTEGER` | `DEFAULT 0` | SQLite Boolean Flag (`0` for false/open, `1` for true/settled). |
| `created_at` | `TEXT` | `DEFAULT (datetime('now'))` | Auto-generated UTC timestamp of record creation. |
| `settled_at` | `TEXT` | - | UTC timestamp when the decision was finalized. |
| `benchmark_status` | `TEXT` | `DEFAULT 'local'` | Current benchmark state: `"local"`, `"pending"`, or `"onchain"`. |
| `tx_hash` | `TEXT` | - | EVM transaction hash of the on-chain creation event. |
| `onchain_decision_id` | `TEXT` | - | Decision ID emitted by `DecisionCreated` when the benchmark registration confirms on-chain. |
| `settlement_tx_hash` | `TEXT` | - | EVM transaction hash of the on-chain settlement event. |
| `automation_session_id` | `TEXT` | - | Associated smart-session identifier when the benchmark was queued through delegated automation. |
| `benchmark_job_id` | `TEXT` | - | Executor-managed job identifier for autonomous benchmark routing. |
| `user_id` | `TEXT` | - | Internal user identifier tying the decision to the user profile. |
| `vault_id` | `TEXT` | - | Dedicated vault identifier used for isolation and executor scoping. |
| `policy_version` | `TEXT` | - | Version of the user’s active vault policy when the decision was generated. |
| `objective` | `TEXT` | `DEFAULT 'income'` | High-level recommendation objective: preserve, income, or growth. |
| `automation_mode` | `TEXT` | `DEFAULT 'recommend-only'` | Whether the decision was advisory-only or eligible for automation. |
| `applied_constraints_json` | `TEXT` | - | Serialized user-specific constraints, limits, allowlists, and caps. |
| `rationale_json` | `TEXT` | - | Serialized explanation of why the recommendation was selected. |

## 📁 Migration SQL Definition

The current schema reflects the combined result of Wrangler migrations `0001_initial.sql`, `0002_benchmark_status.sql`, `0003_automation_foundation.sql`, `0004_user_vault_personalization.sql`, and `0005_live_provider_refs.sql`.


```sql
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id TEXT UNIQUE NOT NULL,
  agent_address TEXT NOT NULL,
  requested_by TEXT DEFAULT '0x0',
  data_snapshot_hash TEXT,
  predicted_apy_bps INTEGER NOT NULL,
  risk_adjusted_apy_bps INTEGER,
  benchmark_rate_bps INTEGER,
  risk_profile TEXT DEFAULT 'conservative',
  allocation_json TEXT,
  settlement_horizon_hours INTEGER DEFAULT 24,
  settlement_due_at TEXT,
  realized_apy_bps INTEGER,
  prediction_error_bps INTEGER,
  outperformance_bps INTEGER,
  is_settled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  settled_at TEXT,
  benchmark_status TEXT DEFAULT 'local',
  tx_hash TEXT,
  onchain_decision_id TEXT,
  settlement_tx_hash TEXT,
  automation_session_id TEXT,
  benchmark_job_id TEXT
);
```

## 🧠 Automation Tables

NeuralRate now persists delegated automation separately from benchmark decisions:

* **`user_profiles`** stores the user identity layer and onboarding model (including Privy details: `privy_user_id`, `provider_user_ref`, `wallet_provider`).
* **`user_agent_configs`** stores personalized objectives, presets, allowlists, limits, and automation preferences.
* **`user_vaults`** stores the dedicated vault for each user, including funding and automation status (plus Safe attributes: `safe_deployment_status`, `safe_salt_nonce`, `provider_vault_ref`, `safe_vault_address`).
* **`vault_permissions`** stores the human-readable and machine-readable execution boundaries for that vault (plus Turnkey signer reference: `turnkey_signer_ref`, `provider_permission_ref`).
* **`user_accounts`** remains as a compatibility mapping between the user's EOA and the resolved smart account address.
* **`automation_policies`** stores executor-facing policy records, mirrored into `vault_permissions`.
* **`automation_sessions`** stores activation state, grant / revoke transaction hashes, permission IDs, Turnkey references (`turnkey_signer_ref`, `provider_session_ref`, `provider_permission_ref`), and raw session consent signatures.
* **`automation_jobs`** stores delegated execution jobs scoped to a specific `user_id`, `vault_id`, and `provider_job_ref`.
* **`benchmark_jobs`** stores benchmark-specific jobs executed by the NeuralRate agent smart wallet using Turnkey so benchmark identity remains isolated from user fund execution (`provider_job_ref`).

