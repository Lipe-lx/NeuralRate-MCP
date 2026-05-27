# NeuralRate MCP

**Status:** Canonical doc

NeuralRate MCP is a Mantle Sepolia (`5003`) project with three public-facing outcomes implemented in code:

- a Cloudflare Worker that exposes a public read-only MCP surface plus scoped mutation catalogs
- a web panel that lets a user inspect state and sign manual actions
- an internal executor that writes on-chain decision receipts, anchors snapshots, and dispatches vault-scoped execution jobs

The current live Sepolia execution demo is a real native `MNT` transfer routed through a pinned Safe module. The preserved `usdy-stable-allocation` path is intentionally blocked on Sepolia unless a canonical venue is configured.

## Current Product Shape

- **Worker is the public control plane.**
  It serves the MCP endpoint and the REST API used by the web app.
- **Executor is internal.**
  The browser should not call it directly. The worker forwards validated jobs to it with an internal token.
- **Web is an operator/user panel.**
  It bootstraps a user vault, displays policies, asks for wallet signatures, and shows grants, sessions, jobs, and benchmark history.
- **On-chain execution policy is now registry-driven.**
  The web app publishes an active policy on-chain and the executor resolves authority from the policy registry before dispatch.
- **On-chain receipts are first-class.**
  New benchmark-style writes target `NeuralRateDecisionReceiptRegistry.sol`; the legacy Sepolia deployment manifest still points to the previous benchmark registry until redeploy.
- **Vault execution is real.**
  The `NeuralRateVaultModule` executes real calls from the user Safe and can defer enforcement to `NeuralRateExecutionGuard`.

## Repository Layout

- `apps/worker`
  Public worker. Hosts the REST API, MCP server, auth nonce flow, grant/session flow, and D1/KV-backed state.
- `apps/executor`
  Internal job runner. Validates execution plans, checks pinned manifests and runtime bytecode, and submits benchmark or vault execution transactions.
- `apps/web`
  Vite React frontend. Connects the wallet, shows vault state, manages settings, and displays execution and benchmark traces.
- `contracts`
  Hardhat workspace for the on-chain policy registry, execution guard, receipt registry, Safe vault module, and preserved USDY adapter.
- `docs`
  Canonical and historical documentation. See [docs/README.md](docs/README.md).

## Architecture Summary

```mermaid
graph TD
    User[User Wallet + Web Panel] -->|REST + signed actions| Worker[Cloudflare Worker]
    Agent[External MCP Agent] -->|Read-only MCP| Worker
    Worker -->|D1| D1[(Cloudflare D1)]
    Worker -->|KV| KV[(Cloudflare KV)]
    Worker -->|internal token| Executor[Internal Executor]
    Worker -->|policy + session discovery| PolicyRegistry[NeuralRatePolicyRegistry]
    Executor -->|receipt tx| ReceiptRegistry[NeuralRateDecisionReceiptRegistry]
    Executor -->|vault module tx| VaultModule[NeuralRateVaultModule]
    VaultModule --> Guard[NeuralRateExecutionGuard]
    VaultModule --> Safe[User Safe Vault]
```

## Public MCP Surface

The worker advertises the public read-only MCP endpoint in [agent-card.json](agent-card.json) at:

- `https://neuralrate-worker.neuralrate.workers.dev/mcp`

The public tool list is:

- `yield_scan`
- `tbill_spread`
- `nansen_context`
- `risk_assess`
- `optimal_allocation`
- `get_decisions`
- `get_user_state`
- `list_jobs`

Scoped mutation catalogs are exposed separately at:

- `/mcp/scoped/config`
- `/mcp/scoped/benchmark`
- `/mcp/scoped/execution`

Each scoped route requires a valid `sessionToken` in the query string or `x-neuralrate-session-token` header before the mutation tool is even advertised.

Details and auth rules are in [docs/mcp-server.md](docs/mcp-server.md).

## Mantle Sepolia Deployments

- Legacy benchmark registry:
  [`0xc51560a5512d2A5756435d87319aeaE1bA480165`](https://sepolia.mantlescan.xyz/address/0xc51560a5512d2A5756435d87319aeaE1bA480165)
- Vault module:
  [`0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11`](https://sepolia.mantlescan.xyz/address/0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11)
- Vault module deploy tx:
  [`0x363de6d6b9153986eb3eddb5089849c5943fc1c1a49b85f4e361f34a5976f556`](https://sepolia.mantlescan.xyz/tx/0x363de6d6b9153986eb3eddb5089849c5943fc1c1a49b85f4e361f34a5976f556)
- Preserved USDY adapter:
  [`0xFeE16FAd13789e9bBA4779D025186341e58799a3`](https://sepolia.mantlescan.xyz/address/0xFeE16FAd13789e9bBA4779D025186341e58799a3)
- USDY adapter deploy tx:
  [`0xee3a1caa73baaa8d3adcd103d44d9bf424b5612b660fc642bc40e11287a9e3c8`](https://sepolia.mantlescan.xyz/tx/0xee3a1caa73baaa8d3adcd103d44d9bf424b5612b660fc642bc40e11287a9e3c8)

## Strategy Truth on Sepolia

- **Default live demo:** `mnt-native-transfer`
- **Default live asset:** `MNT`
- **Execution type:** real native transfer through `NeuralRateVaultModule`
- **Preserved strategy:** `usdy-stable-allocation`
- **Sepolia behavior for USDY:** blocked with an explicit reason when no canonical venue is configured

The executor does not simulate an Ondo venue on testnet.

## Local Development

The stack expects Mantle Sepolia and a local executor URL:

```env
EXECUTOR_BASE_URL=http://127.0.0.1:8788
VITE_PUBLIC_NEURALRATE_VAULT_MODULE_ADDRESS=0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11
NEURALRATE_DEMO_STRATEGY_KEY=mnt-native-transfer
NEURALRATE_DEMO_TARGET_ASSET=MNT
NEURALRATE_MNT_STRATEGY_RECIPIENT_ADDRESS=
```

Start the services in separate terminals:

```bash
cd apps/worker && npm install && npx wrangler dev
cd apps/executor && npm install && npm run dev
cd apps/web && npm install && npm run dev
```

For the web app, the worker is the API surface. The executor is only for worker-to-executor calls.

## Release Workflow

Before opening a PR or pushing a release commit, refresh the checked-in deployment metadata and run the release preflight:

```bash
npm run sync:deployments
npm run preflight:release
```

What these commands do:

- `npm run sync:deployments`
  - copies the canonical Mantle Sepolia deployment addresses from `deployments/*.json`
  - updates checked-in examples and worker plaintext bindings such as `apps/worker/wrangler.toml`
  - keeps the public AA contract addresses aligned across worker, web, and executor examples
- `npm run preflight:release`
  - checks the local root `/.env` for the minimum runtime required to operate Worker + executor + AA bundler flow
  - validates the presence of the AA addresses, Turnkey configuration, internal token, and bundler source

If both commands pass, the repository is ready to be committed. This does **not** mean local secrets from `/.env` will be uploaded by Git push alone.

Operational rule:

- if you changed runtime variables, public bindings, deployment metadata, or checked-in env examples, run `npm run sync:deployments` and `npm run preflight:release` before pushing

## Deployment Trigger Model

NeuralRate does **not** use GitHub Actions as the publish path for the public web or worker surfaces.

- `apps/web`
  Deploys through Cloudflare Pages Git integration configured in Cloudflare.
- `apps/worker`
  Deploys through Cloudflare Workers Git integration configured in Cloudflare.

Operational rule:

- if the connected branch is pushed, Cloudflare triggers the deployment
- the trigger lives in Cloudflare platform configuration, not in versioned GitHub workflow files in this repository

What still requires operator awareness:

- local `/.env` values are not uploaded by a normal Git push
- Worker secrets still depend on explicit Cloudflare secret management
- the executor may have a separate deployment path outside this repository

See [docs/deployment.md](docs/deployment.md) for the canonical deployment note.

## Configuration Security

NeuralRate now distinguishes between public Worker bindings and secret Worker/runtime credentials:

- `apps/worker/wrangler.toml`
  - stores **plaintext non-secret bindings** only
  - examples: deployed contract addresses, `EXECUTOR_BASE_URL`
- Cloudflare Worker secrets
  - store **secret bindings** only
  - examples: `FRED_API_KEY`, `NANSEN_API_KEY`, `INTERNAL_API_TOKEN`
- root `/.env`
  - local operator file
  - used for local runtime sync and preflight checks
  - must **not** be committed

Important security rules:

- Do not put API keys, internal tokens, or signer credentials in `wrangler.toml`.
- Do not assume `/.env` is visible to GitHub Actions or Cloudflare just because it exists locally.
- Treat `deployments/*.json` and `wrangler.toml` as the source of truth for non-secret contract addresses that should ship with the repository.
- Treat secrets as external CI/platform configuration unless you explicitly publish them with Wrangler.

## Documentation Index

- [docs/architecture.md](docs/architecture.md)
- [docs/mcp-server.md](docs/mcp-server.md)
- [docs/database.md](docs/database.md)
- [docs/smart-contract.md](docs/smart-contract.md)
- [docs/frontend.md](docs/frontend.md)
- [docs/hackathon-submission.md](docs/hackathon-submission.md)
- [docs/README.md](docs/README.md)
