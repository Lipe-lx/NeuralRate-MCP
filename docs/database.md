# D1 Database Schema

To maintain persistent, verifiable, and historical decision-making logs for both the operator-facing benchmark terminal and autonomous agents, NeuralRate MCP utilizes **Cloudflare D1**, a native serverless SQLite database.

---

## 📋 Database Specifications

* **Binding Name:** `DECISIONS_DB`
* **Local Location:** `.wrangler/state/v3/d1`
* **Database Name:** `neuralrate-decisions`
* **Table Name:** `decisions`

---

## 🗄️ Table Schema: `decisions`

The `decisions` table maps all fields required to perform auditing and tracking for autonomous yields:

| Column Name | SQL Data Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Auto-incrementing internal unique sequence ID. |
| `decision_id` | `TEXT` | `UNIQUE NOT NULL` | Structured unique hex decision hash (e.g. `0xdec_...`). |
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
| `tx_hash` | `TEXT` | - | EVM transaction hash of the on-chain creation event. |
| `settlement_tx_hash` | `TEXT` | - | EVM transaction hash of the on-chain settlement event. |

---

## 📁 Migration SQL Definition

The database was initialized via Wrangler migration `0001_initial.sql` using the following exact SQL statement:

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
  tx_hash TEXT,
  settlement_tx_hash TEXT
);
```
