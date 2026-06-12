# Frontend

**Status:** Canonical doc

The frontend lives in `apps/web` and is a Vite React application. It is a panel for state inspection and manual actions; it is not the public control plane.

## What the Web App Does

- connects a browser wallet on Mantle Sepolia
- bootstraps a user profile and vault through the worker
- requests nonce signatures for owner-authorized actions
- requests canonical grant signatures for MCP mutation sessions
- shows benchmark history and automation jobs
- shows live vault telemetry, including native MNT and configured tracked ERC-20 balances
- queues benchmark and strategy actions through the worker

The frontend should call the worker, not the executor.

## Minimal Automation Onboarding

The onboarding flow is intentionally short and treats Safe7579/ERC-4337 as the canonical runtime:

1. connect the wallet and switch to Mantle Sepolia
2. bootstrap the user profile and predicted Safe vault, with the ownership review included in the same owner-authenticated mutation
3. authorize automation through one guided action:
   - publish the active on-chain execution policy
   - sign the canonical automation grant
   - activate the Safe7579/ERC-4337 runtime with batched Safe admin calls when runtime setup is required
4. launch or hand the scoped MCP session token to an agent

These are distinct backend records:

- `automation_grants` and `mcp_mutation_sessions`
- `automation_sessions`

Funding intent is not part of the production onboarding UI. The vault can receive any amount directly whenever the user chooses, and live funding telemetry is derived from on-chain balance reads rather than an extra signed mutation in the activation path.

When the Mantle Sepolia demo profile includes `NEURALRATE_USDY_TOKEN_ADDRESS`, the same telemetry surface also tracks Mock USDY balances for the agent Safe vault.

Legacy direct-signer or module-only runtime fallback is not a supported onboarding success path. If Safe7579, the delegate validator, the vault module, the execution guard, or required guard trust settings are missing, onboarding should fail as a release/configuration error.

## Network Defaults

Current frontend defaults in code target Mantle Sepolia:

- chain ID: `5003`
- RPC: `https://rpc.sepolia.mantle.xyz`
- explorer: `https://sepolia.mantlescan.xyz`

Relevant public envs include:

- `VITE_PUBLIC_NEURALRATE_BENCHMARK_CONTRACT`
- `VITE_PUBLIC_NEURALRATE_VAULT_MODULE_ADDRESS`
- `VITE_PUBLIC_MANTLE_RPC_URL`
- `VITE_PUBLIC_ERC8004_AGENT_ID`
- `VITE_PUBLIC_ERC8004_IDENTITY_REGISTRY`

## Main UI Areas

### Yield and analytics panels

The app displays:

- yield scan results
- risk assessment details
- Nansen context when available

These are read-only views backed by worker endpoints.

### `VaultPanel`

This is the main automation and vault status surface.

It shows:

- vault identity and address
- funding status
- tracked token balances, including Mock USDY when configured
- automation status
- current policy-derived limits
- active grant and mutation session state
- Safe module execution readiness

It also lets the user:

- bootstrap the vault
- review wallet ownership and export/recovery options
- copy the vault deposit address for direct funding
- mint testnet-only Mock USDY directly to the agent Safe vault when the demo faucet is configured
- enable automation
- revoke automation

The Mock USDY Faucet signs a wallet transaction from the connected owner EOA to the Mock USDY contract, but the encoded `mint(to, amount)` recipient is the agent Safe vault address. The faucet is only a Mantle Sepolia demo harness and is not canonical Ondo USDY.

### `VaultTelemetryPanel`

This panel renders worker-derived runtime telemetry:

- native vault balance and read status
- configured tracked ERC-20 balances from `runtimeState.tokenBalances`
- funding detection based on live or cached on-chain reads
- execution readiness context for the active vault

The browser may perform supplemental local balance reads, but the durable product state is the worker snapshot. Direct deposits and Mock USDY mints should appear after the next on-chain balance refresh.

### `AgentSettingsPanel`

This panel updates the stored per-user policy through the worker.

Policy fields exposed in the UI include:

- objective
- risk profile
- automation mode
- restriction preset
- allowlists and deny lists
- action, daily, and total automation limits
- slippage and manual-review thresholds

### `DecisionLedger`

This panel:

- logs and displays decisions
- shows benchmark status
- queues benchmark jobs through the worker
- renders tx hashes and on-chain IDs when available

## Production Funding and Demo Token UX

The production UI does not ask the user to predeclare an amount. It shows the vault address as the funding surface, lets the user copy it, and reflects direct deposits from on-chain telemetry. Demo strategy queueing is not exposed as a primary product action.

Mock USDY is the exception for Mantle Sepolia demos: the faucet exists so judges and agents can fund the Safe vault with an ERC-20 balance that exercises the governed token routing path. The copy must keep the token clearly labeled as mock/testnet-only.

## Agent Access

The frontend includes an MCP access modal. Its purpose is informational:

- show the MCP endpoint
- help the user copy MCP connection details

The MCP server itself is still the worker endpoint advertised in `agent-card.json`.
