# Frontend

**Status:** Canonical doc

The frontend lives in `apps/web` and is a Vite React application. It is a panel for state inspection and manual actions; it is not the public control plane.

## What the Web App Does

- connects a browser wallet on Mantle Sepolia
- bootstraps a user profile and vault through the worker
- requests nonce signatures for owner-authorized actions
- requests canonical grant signatures for MCP mutation sessions
- shows benchmark history and automation jobs
- queues benchmark and strategy actions through the worker

The frontend should call the worker, not the executor.

## Manual Automation Flow

The current web flow combines worker-side grant/session state with Safe-side module enablement:

1. request a nonce for owner-authenticated mutations when needed
2. request a grant challenge from the worker
3. sign the canonical automation grant
4. issue the grant through the worker and receive the mutation-session context
5. resolve or deploy the user Safe
6. enable `NeuralRateVaultModule` on the Safe
7. sign the separate `NeuralRate Vault Automation Consent` message used for `automation_sessions`

These are distinct backend records:

- `automation_grants` and `mcp_mutation_sessions`
- `automation_sessions`

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
- automation status
- current policy-derived limits
- active grant and mutation session state
- Safe module execution readiness

It also lets the user:

- bootstrap the vault
- acknowledge wallet ownership
- enable automation
- revoke automation
- queue the default demo strategy

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

## Current Sepolia Demo Truth

The default strategy demo in the frontend is:

- strategy key: `mnt-native-transfer`
- target asset: `MNT`

The preserved USDY path is not presented as a live canonical Sepolia strategy. When the backend marks that venue as unavailable, the UI shows the explicit failure reason coming back from the worker/executor flow.

## Agent Access

The frontend includes an MCP access modal. Its purpose is informational:

- show the MCP endpoint
- help the user copy MCP connection details

The MCP server itself is still the worker endpoint advertised in `agent-card.json`.
