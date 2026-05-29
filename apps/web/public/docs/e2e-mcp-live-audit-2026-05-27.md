# NeuralRate MCP Audit Report

Audit date: 2026-05-27
Endpoint tested: https://neuralrate-worker.neuralrate.workers.dev/mcp

Post-deploy revalidation completed on 2026-05-27.

## Scope

Smoke testing of the public MCP endpoint using a real protocol client.

Rules followed:

- no internal routes were used
- no shortcut call replaced the MCP client
- the test was run against the public production endpoint

## Methodology

Executed flows:

1. Connect to the public MCP via Streamable HTTP
2. List the tool catalog
3. Call real read-only tools
4. Attempt a mutation call with an invalid session token

Tools exercised:

- `yield_scan`
- `tbill_spread`
- `risk_assess`
- `optimal_allocation`
- `get_user_state`
- `list_jobs`
- `update_agent_policy` with an invalid token

## Results

### 1. Connection and handshake

[OK] The MCP client connected successfully.

[OK] The server responded with:

- `name`: `neuralrate-mcp-readonly`
- `version`: `1.0.0`

### 2. Public catalog

[OK] The endpoint returned tools.

[OK] The exposed public catalog is now restricted to the read-only subset expected by the documentation:

- `yield_scan`
- `tbill_spread`
- `nansen_context`
- `risk_assess`
- `optimal_allocation`
- `get_decisions`
- `get_user_state`
- `list_jobs`

[OK] No mutable tools were observed in the public catalog.

### 3. Read-only tools

[OK] The main public tools returned real data:

- `yield_scan` returned real Mantle pools, including `SYRUPUSDT`, `SUSDE`, and `USDY`
- `tbill_spread` returned a calculated spread of `132 bps` for `apy = 5`
- `risk_assess` returned a `59/100` score with `HIGH` classification
- `optimal_allocation` returned a three-asset allocation proposal
- `get_user_state` returned the expected empty state for `ownerEoa = 0x000...000`
- `list_jobs` returned empty queues

### 4. Mutation with invalid token

[OK] The `update_agent_policy` call with an invalid `sessionToken` was rejected.

Observed response:

- `MCP error -32602: Tool update_agent_policy not found`

Interpretation:

- runtime validation is still in place
- the mutation is no longer exposed in the public catalog

## Findings

### Confirmed

1. The public MCP is accessible and functional.
2. The read-only tools return real data.
3. The public catalog is now aligned with the documented read-only contract.
4. The tested mutation did not execute and no longer appears in the public catalog.

### Main risk

1. The main risk observed in the previous round has been corrected.
2. The remaining focus is preserving the separation between the public read-only catalog and scoped mutation catalogs.

## Conclusion

The public MCP is operational and the published catalog now matches the expected read-only subset.

The smoke confirmed:

- valid handshake
- real tools responding
- runtime guard rails for invalid mutations
- no mutable tools in the public catalog
