# Hackathon Submission Pack

**Status:** Canonical doc

This file is intentionally factual. It describes the current codebase behavior and demoable scope, not future intent.

## One-Liner

NeuralRate MCP is a Mantle Sepolia worker and MCP server that benchmarks agent decisions on-chain, stores per-user vault policy in D1, and dispatches real Safe-module execution jobs under owner-signed grants.

## What the Demo Actually Shows

1. The user connects a wallet on Mantle Sepolia.
2. The web app bootstraps a dedicated user vault through the worker.
3. The user acknowledges vault ownership context in the UI.
4. The user signs a canonical automation grant.
5. The worker stores the grant and creates a short-lived MCP mutation session.
6. The web app enables the Safe module on the user vault and stores a separate automation consent record.
7. A decision can be logged locally and queued for benchmark.
8. The executor writes the benchmark transaction on-chain and the worker stores the resulting tx hash and on-chain decision ID.
9. The default live execution demo queues a real `MNT` transfer through the Safe module.

## Architecture Slide

- **Worker**
  Public REST and MCP surface. Validates auth, stores state, issues grants and sessions, and queues jobs.
- **Executor**
  Internal service. Validates execution plans and submits benchmark or vault-module transactions.
- **Web**
  User/operator panel. Shows state and gathers signatures.
- **Benchmark registry**
  `NeuralRateDecisionBenchmark.sol` on Mantle Sepolia.
- **Vault module**
  `NeuralRateVaultModule.sol` on Mantle Sepolia.

## Trust Model Slide

- State-changing owner actions use a signed nonce envelope.
- Agent mutation sessions come from a separate canonical automation grant.
- Grants are domain-scoped and time-bounded.
- The worker is the public authorization layer.
- The executor is internal and only accepts worker-authenticated requests.
- Benchmark identity is separate from user vault execution.
- The live Sepolia demo uses a real Safe module and a real on-chain transaction.

## Current Strategy Truth

- `mnt-native-transfer`
  - live default demo
  - real native `MNT` transfer through the Safe module
- `usdy-stable-allocation`
  - preserved in code
  - not the default demo
  - blocked on Sepolia when no canonical venue is configured

## Claims That Match the Current Code

- The MCP server exposes analytics tools and mutation-capable tools.
- User policy and vault state are persisted in D1.
- The worker issues automation grants and short-lived mutation sessions.
- Benchmark writes are real Mantle Sepolia transactions.
- The worker stores the resulting benchmark tx hash and on-chain decision ID.
- The live Sepolia execution demo routes through a deployed Safe module.
- Unsupported Sepolia venues fail closed with an explicit reason.

## Claims This Repository Does Not Prove by Default

- generalized Sepolia USDY execution against a canonical third-party venue
- universal cross-protocol execution for arbitrary assets
- mainnet deployment by default
- on-chain grant issuance for every automation session
