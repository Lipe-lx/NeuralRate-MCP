# MCP Server

**Status:** Canonical doc

The MCP server runs inside `apps/worker` and is split into one public read-only catalog plus four scoped catalogs:

- `state` for read-only vault introspection bound to one scoped automation session
- `config` for policy and runtime mutations
- `benchmark` for benchmark anchoring flows
- `execution` for strategy execution flows

## Endpoints

### Public Read-Only

- `/mcp`
- `/sse` as the legacy transport alias

This is the endpoint advertised in [agent-card.json](../agent-card.json).

Preferred client behavior as of 2026-06-12:

- use `/mcp` as the canonical remote MCP endpoint
- prefer Streamable HTTP client configs (`type: "http"` in most clients)
- treat `/sse` only as a compatibility fallback for older clients

### Scoped Catalogs

- `/mcp/scoped/state`
- `/mcp/scoped/config`
- `/mcp/scoped/benchmark`
- `/mcp/scoped/execution`

Legacy aliases also exist under `/sse/scoped/*`.

Each scoped route requires:

- `x-neuralrate-session-token` header, preferred for browser and agent clients
- `sessionToken` in the query string, legacy bootstrap fallback only

If the token does not contain the required domain, the catalog is rejected before tool advertisement.

Do not share scoped URLs containing query-string tokens in screenshots, logs, or issue reports. Prefer copyable header-based client configuration so the token is not stored in browser history, intermediary logs, or referrers.

## Public Tool Catalog

The public read-only endpoint exposes:

- `yield_scan`
- `tbill_spread`
- `nansen_context`
- `risk_assess`
- `optimal_allocation`

The public catalog intentionally does not expose vault-bound state or execution surfaces.

## Scoped State Tools

`/mcp/scoped/state` exposes:

- `get_user_state`
- `get_vault_balances`
- `get_open_positions`
- `get_execution_readiness`
- `get_policy_surface`
- `get_activity_feed`
- `list_jobs`
- `get_decisions`
- `get_benchmark_history`
- `get_decision_lineage`
- `get_audit_summary`

These tools are session-bound and return only the vault attached to the scoped session.

`get_vault_balances` returns the native vault balance plus configured tracked ERC-20 balances. On the Mantle Sepolia demo profile, `NEURALRATE_USDY_TOKEN_ADDRESS` tracks the Mock USDY testnet token so agents can verify faucet funding before queueing `mock-usdy-sepolia-allocation`.

## Scoped Mutation Tools

The mutation catalogs remain intentionally narrow and reuse the same scoped session model.

### `/mcp/scoped/config`

- tools:
  - `update_agent_policy`
  - `prepare_policy_publish`
  - `submit_policy_publish`
  - `prepare_policy_revoke`
  - `submit_policy_revoke`
  - `prepare_vault_runtime_enable`
  - `submit_vault_runtime_enable`
  - `prepare_vault_runtime_disable`
  - `submit_vault_runtime_disable`
  - `prepare_automation_grant`
  - `submit_automation_grant`
  - `revoke_automation_grant`
- required session domain: `config`

### `/mcp/scoped/benchmark`

- tools:
  - `get_benchmark_history`
  - `queue_benchmark`
- required session domain: `benchmark`

### `/mcp/scoped/execution`

- tools:
  - `transfer_asset`
  - `open_position`
  - `increase_position`
  - `decrease_position`
  - `close_position`
  - `claim_rewards`
  - `sweep_idle_balance`
  - `rebalance_to_target`
  - `rotate_strategy`
  - `approve_strategy_spender`
  - `prepare_mock_usdy_mint`
  - `execute_strategy`
- required session domain: `execution`

The governed execution tools always run an internal preflight before any queueing side effect. As of June 12, 2026, the live execution surface is intentionally narrower than the full conceptual tool list:

- fully queueable today:
  - `transfer_asset` for `MNT`
  - `sweep_idle_balance` for `MNT`
  - `open_position` for `USDY`
  - `increase_position` for `USDY`
  - `decrease_position` for wallet-held `MNT` and `USDY`
  - `close_position` for wallet-held `MNT` and `USDY`
  - `rebalance_to_target` into `USDY`
  - `approve_strategy_spender`
- preflight-aware special cases:
  - `prepare_mock_usdy_mint` returns a wallet-signable Mock USDY mint transaction for Mantle Sepolia demo funding; it does not submit the transaction server-side
  - by default, `prepare_mock_usdy_mint` mints to the agent Safe vault attached to the scoped session, not to the owner's EOA
  - `open_position`, `increase_position`, `rebalance_to_target`, and `rotate_strategy` accept `protocolHint: "mock-usdy-sepolia"` to use the labeled Mock USDY Mantle Sepolia testnet harness
  - `claim_rewards` returns `noop` when the resolved position has no claimable rewards on the current state surface, and `blocked` when rewards exist but no pinned claim adapter exists yet
  - `rotate_strategy` returns `noop` when the source position already matches the requested target asset, aliases to `rebalance_to_target` when rotating into `USDY`, and returns `blocked` for unsupported unwind or conversion paths
- still intentionally blocked until more adapters are pinned:
  - canonical `usdy-stable-allocation` on Sepolia when no Ondo venue is configured
  - non-wallet position decrease and close flows
  - reward-claim adapters for protocols that expose claimable rewards
  - multi-venue rotation and unwind paths beyond the current one-sided USDY flow

## Scoped Resources

`/mcp/scoped/state` also exposes resource templates for heavier JSON snapshots:

- `resource://vault/{vaultRef}/portfolio`
- `resource://vault/{vaultRef}/policy`
- `resource://vault/{vaultRef}/activity`

`vaultRef` accepts `current` plus the vault identifiers advertised by the current scoped session.

## Scoped Prompts

`/mcp/scoped/state` exposes prompts for explicit review flows:

- `review-portfolio`
- `review-execution-readiness`
- `explain-why-blocked`

These prompts are built from the same underlying state snapshots as the tools and resources above.

## Route-Level Behavior

The route itself now participates in access control:

1. the client presents a `sessionToken`
2. the worker resolves the stored session
3. the worker checks the domain against the requested scoped catalog
4. only then is the MCP server for that domain served

This reduces accidental tool exposure to the model compared with a single static mutation catalog.

## Grant and Session Model

The worker still supports two auth paths:

1. **signed owner action**
   A short-lived nonce envelope signed by the owner wallet.
2. **scoped MCP session**
   A canonical automation grant signed by the owner, then converted into a short-lived `sessionToken`.

After automation is enabled, the web app can mint or rotate a fresh scoped MCP credential bundle through:

- `POST /api/automation/mcp/access`

That endpoint requires the same signed owner mutation envelope and returns the scoped routes plus the new `x-neuralrate-session-token` value to hand to an external agent or MCP client.

The `sessionToken` is now primarily used for MCP scoping and discovery. Real strategy execution is additionally checked against on-chain policy and guard state by the executor and contracts.

## Snapshot-Aware Strategy Inputs

`execute_strategy` now accepts snapshot-aware intent fields:

- `intent.snapshotHash`
- `intent.snapshotCid`
- `intent.deadline`
- `intent.slippageBps`

The executor expects these values when building an on-chain execution intent.

The governed strategy helpers such as `open_position` also pass snapshot-aware intent fields through to the executor. If the active policy requires snapshots, clients should provide:

- `snapshotHash`
- `snapshotCid`
- `deadline`
- `slippageBps`

The deadline must be inside the active policy validity window. A missing or expired snapshot/deadline is treated as a preflight or executor failure, not silently ignored.

## Current Live Execution Proof

On 2026-06-12, the scoped execution MCP catalog confirmed a Mock USDY allocation through the full Safe7579 path:

- tool: `open_position`
- protocol hint: `mock-usdy-sepolia`
- strategy: `mock-usdy-sepolia-allocation`
- Safe vault: `0xa151ca59f090946ab1ac1f8028771ec716a9a82f`
- token: Mock USDY at `0xC63FB10deD215c6De6cDB438FB2Ce7944F6Af5bE`
- amount: `1 USDY`
- job id: `job_45f65784-6756-4124-9a75-7870c8b66806`
- userOpHash: `0x3b55075fed671db366b2e1fc6447da31b0fb149e0e739f337dfbf5099168b637`
- tx_hash: `0x36281947f5fb3088c29e6926979f150eb10ee03e5be86e4973599bf8823409b6`
- result: transaction receipt status `1`, gas paid by paymaster, `anchoredSnapshot: true`

This proof demonstrates the testnet Mock USDY harness only. It does not claim canonical Ondo USDY execution on Mantle Sepolia.

## Out of Public MCP Scope

The following capabilities remain available through REST or legacy/internal flows, but are not advertised on the public MCP catalog:

- bootstrap user vault mutations
- automation grant issuance
- grant revocation
- local decision logging

This separation is intentional and reduces the amount of mutable surface shown to external models by default.
