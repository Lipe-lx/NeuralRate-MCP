# MCP Server

**Status:** Canonical doc

The MCP server runs inside `apps/worker` and is exposed at `/mcp`. The public endpoint currently advertised in [agent-card.json](../agent-card.json) is:

- `https://neuralrate-worker.neuralrate.workers.dev/mcp`

The worker also exposes a REST API for the web app. This document covers the MCP surface only.

## Tool Catalog

The current public tool list contains 15 tools.

### Analytics and Logging

#### `yield_scan`

- purpose: fetch Mantle yield pools from DefiLlama and filter them
- auth: none
- key args:
  - `minTvlUsd`
  - `chainFilter`

#### `tbill_spread`

- purpose: compare an APY to the current FRED 3M T-Bill rate
- auth: none
- key args:
  - `apy`

#### `nansen_context`

- purpose: fetch smart-money context for a token address
- auth: none
- key args:
  - `tokenAddress`
  - `chain`

#### `risk_assess`

- purpose: compute the deterministic 6-factor risk score
- auth: none
- key args:
  - `protocolTvlUsd`
  - `apy`
  - `apyBase`
  - `apyReward`
  - `volumeUsd1d`
  - `volumeUsd7d`
  - `apyMean30d`
  - `apyPct1D`
  - `apyPct7D`
  - `ilRisk`
  - `stablecoin`
  - `sigma`
  - `nansenSmartMoneyNetFlow`

#### `optimal_allocation`

- purpose: rank and allocate across Mantle pools using deterministic rules plus stored user policy when available
- auth: none
- notes:
  - accepts optional `ownerEoa` and `userId`
  - resolves stored vault policy when `ownerEoa` is supplied
- key args:
  - `amountUsd`
  - `objective`
  - `riskProfile`
  - `horizonHours`
  - allowlists, deny lists, and caps

#### `log_decision`

- purpose: store a decision record in D1
- auth: none
- key args:
  - `decisionId`
  - `agentAddress`
  - `predictedApyBps`
  - optional user, vault, policy, and benchmark fields

#### `get_decisions`

- purpose: list stored decisions
- auth: none
- key args:
  - `limit`
  - optional `ownerEoa`

### MCP Mutation and State Tools

#### `get_user_state`

- purpose: return the `AutomationState` used by the web app
- auth:
  - `sessionToken`, or
  - `ownerEoa`
- domain required for `sessionToken`: `state`

#### `bootstrap_user_vault`

- purpose: create or update the user profile and dedicated vault record
- auth:
  - owner-signed `auth` envelope
- key args:
  - `ownerEoa`
  - optional profile and vault bootstrap fields

#### `update_agent_policy`

- purpose: update the stored per-user policy and limits
- auth:
  - `sessionToken`, or
  - `ownerEoa` plus signed `auth`
- domain required for `sessionToken`: `config`

#### `issue_automation_grant`

- purpose: verify a canonical automation grant signature and mint a short-lived MCP mutation session
- auth:
  - owner signature over the grant message
- key args:
  - `ownerEoa`
  - `agentSubject`
  - `allowedDomains`
  - `policyVersion`
  - `issuedAt`
  - `expiresAt`
  - `nonce`
  - `signature`
  - `issuedVia`

#### `revoke_automation_grant`

- purpose: revoke an active grant and associated mutation session
- auth:
  - `sessionToken`, or
  - `grantId`, or
  - `ownerEoa` plus signed `auth`

#### `queue_benchmark`

- purpose: queue a benchmark job for an existing decision
- auth:
  - `sessionToken`, or
  - `ownerEoa` plus signed `auth`
- domain required for `sessionToken`: `benchmark`
- key args:
  - `decisionId`
  - optional `dataSnapshotHash`
  - optional `payload`

#### `execute_strategy`

- purpose: queue a strategy execution job
- auth:
  - `sessionToken`, or
  - `ownerEoa` plus signed `auth`
- domain required for `sessionToken`: `execution`
- key args:
  - `strategyKey`
  - `intent.targetAsset`
  - `intent.amountUsd`
  - `intent.amountToken`
  - `intent.slippageBps`
  - optional `payload`

#### `list_jobs`

- purpose: list benchmark and execution jobs visible to an owner or active mutation session
- auth:
  - `sessionToken`, or
  - `ownerEoa`
- domain required for `sessionToken`: `state`

## Grant and Session Model

The worker implements two distinct authorization paths for state-changing operations:

1. **signed owner action**
   A short-lived nonce envelope signed by the owner wallet.
2. **granted MCP mutation session**
   A canonical automation grant signed by the owner, then converted into a short-lived `sessionToken`.

### Canonical Grant Message

The message built in `apps/worker/src/grants.ts` includes:

- owner
- user ID
- vault ID
- vault address
- agent subject
- policy version
- allowed domains
- nonce
- issued at
- expires at
- chain ID `5003`

The worker verifies the signature by recovering the signer and matching it to `ownerEoa`.

### Session Token

After a valid grant is issued:

- the worker creates a session token with prefix `nrmcp_`
- only the SHA-256 hash is stored in D1
- tools resolve the owner and vault scope from that stored session
- tools check that the requested domain is included in the grant

## AutomationState Shape

`get_user_state` returns the same top-level shape consumed by the frontend:

- `ownerEoa`
- `userId`
- `profile`
- `config`
- `vault`
- `permissions`
- `activePermission`
- `sessions`
- `activeSession`
- `grants`
- `activeGrant`
- `mcpSessions`
- `activeMcpSession`
- `automationJobs`
- `benchmarkJobs`
- `automationReady`

## Deterministic Analytics

The worker still contains the deterministic analytics stack:

- DefiLlama-backed yield scanning
- FRED-backed T-Bill spread
- Nansen-backed context when configured
- a 6-factor risk model
- deterministic allocation heuristics constrained by policy

This is the same analytics surface available to agents without any automation grant.
