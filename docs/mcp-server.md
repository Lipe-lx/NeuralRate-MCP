# MCP Server

**Status:** Canonical doc

The MCP server runs inside `apps/worker` and is split into one public read-only catalog plus three scoped mutation catalogs.

## Endpoints

### Public Read-Only

- `/mcp`
- `/sse` as the legacy transport alias

This is the endpoint advertised in [agent-card.json](../agent-card.json).

### Scoped Mutation Catalogs

- `/mcp/scoped/config`
- `/mcp/scoped/benchmark`
- `/mcp/scoped/execution`

Legacy aliases also exist under `/sse/scoped/*`.

Each scoped route requires:

- `sessionToken` in the query string, or
- `x-neuralrate-session-token` header

If the token does not contain the required domain, the catalog is rejected before tool advertisement.

## Public Tool Catalog

The public read-only endpoint exposes:

- `yield_scan`
- `tbill_spread`
- `nansen_context`
- `risk_assess`
- `optimal_allocation`
- `get_decisions`
- `get_user_state`
- `list_jobs`

`get_user_state` and `list_jobs` can still be scoped with `sessionToken` or queried directly by `ownerEoa`.

## Scoped Mutation Tools

All scoped catalogs include the same read-only tools above, plus one mutation tool:

### `/mcp/scoped/config`

- extra tool: `update_agent_policy`
- required session domain: `config`

### `/mcp/scoped/benchmark`

- extra tool: `queue_benchmark`
- required session domain: `benchmark`

### `/mcp/scoped/execution`

- extra tool: `execute_strategy`
- required session domain: `execution`

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

The `sessionToken` is now primarily used for MCP scoping and discovery. Real strategy execution is additionally checked against on-chain policy and guard state by the executor and contracts.

## Snapshot-Aware Strategy Inputs

`execute_strategy` now accepts snapshot-aware intent fields:

- `intent.snapshotHash`
- `intent.snapshotCid`
- `intent.deadline`
- `intent.slippageBps`

The executor expects these values when building an on-chain execution intent.

## Out of Public MCP Scope

The following capabilities remain available through REST or legacy/internal flows, but are not advertised on the public MCP catalog:

- bootstrap user vault mutations
- automation grant issuance
- grant revocation
- local decision logging

This separation is intentional and reduces the amount of mutable surface shown to external models by default.
