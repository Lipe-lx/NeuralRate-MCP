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

Funding intent is not a blocking onboarding step. The vault can receive funds whenever the user chooses, and live funding telemetry should be derived from on-chain reads rather than required as an extra signed mutation in the activation path.

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
- automation status
- current policy-derived limits
- active grant and mutation session state
- Safe module execution readiness

It also lets the user:

- bootstrap the vault
- review wallet ownership and export/recovery options
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
