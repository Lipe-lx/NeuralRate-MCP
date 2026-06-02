# Observability And Operations

**Status:** Canonical doc

## Operator Endpoints

- `GET /api/health`
  - environment capability check (keys, executor, RPC, internal token)
  - MCP route visibility
- `GET /api/audit/summary?ownerEoa=0x...`
  - requires signed read auth
  - summarizes policy, grant, session, blocked/executed jobs, and benchmark receipt presence
- `POST /api/telemetry/error`
  - receives error objects from frontend or worker components
  - inserts event records into D1 `telemetry_events` table
- `GET /api/telemetry/summary`
  - returns aggregate counts of logged events from the last 24 hours grouped by severity level

## Audit Event Categories

- `policy_published`
- `grant_issued`
- `session_created`
- `strategy_blocked`
- `strategy_executed`
- `receipt_created`

## Runbook

1. Validate platform health first (`/api/health`).
2. For a user incident, fetch `/api/audit/summary` with signed auth.
3. Correlate `strategy_blocked` and `receipt_created` with worker/executor logs.
4. If grant/session is stale, rotate session and re-issue scoped grant.

## Current Limits

- dashboards are endpoint-first (no dedicated UI dashboard yet)
- error monitoring is still log-centric and should be integrated with a dedicated alerting stack
