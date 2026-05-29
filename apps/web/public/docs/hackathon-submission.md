# Hackathon Submission Pack

**Status:** Canonical doc

This file is intentionally factual. It describes the current codebase behavior and demoable scope, not future intent.

## One-Liner

NeuralRate MCP is a Mantle Sepolia worker and MCP server that anchors per-user vault policy on-chain, records decision receipts on-chain, and dispatches real Safe-module execution jobs under owner-approved automation scope.

## What the Demo Actually Shows

1. The user connects a wallet on Mantle Sepolia.
2. The web app bootstraps a dedicated user vault through the worker.
3. The user acknowledges vault ownership context in the UI.
4. The user signs a canonical automation grant.
5. The worker stores the grant and creates a short-lived MCP scoped session.
6. The web app enables the Safe module on the user vault and publishes the active policy on-chain.
7. A decision can be logged locally and queued for an on-chain receipt.
8. The executor anchors the referenced snapshot and writes the receipt transaction on-chain.
9. The default live execution demo queues a real `MNT` transfer through the Safe module.

## Architecture Slide

- **Worker**
  Public REST and MCP surface. Validates auth, stores indexed state, issues grants and sessions, and queues jobs.
- **Executor**
  Internal service. Resolves on-chain policy, anchors snapshots, and submits receipt or vault-module transactions.
- **Web**
  User/operator panel. Shows state and gathers signatures.
- **Receipt registry**
  `NeuralRateDecisionReceiptRegistry.sol` for new deployments, with the legacy benchmark registry still present in the current Sepolia manifest until redeploy.
- **Vault module**
  `NeuralRateVaultModule.sol` on Mantle Sepolia.

## Trust Model Slide

- State-changing owner actions use a signed nonce envelope.
- Scoped MCP sessions come from a separate canonical automation grant.
- Grants are domain-scoped and time-bounded.
- The worker is the public discovery and queueing layer.
- The on-chain policy registry and execution guard are part of execution enforcement.
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

- The MCP server exposes a public read-only catalog plus scoped mutation catalogs.
- User policy and vault state are persisted in D1 and mirrored on-chain for the active automation policy.
- The worker issues automation grants and short-lived scoped sessions.
- Decision receipt writes are real Mantle Sepolia transactions in the new contract path.
- The worker stores the resulting receipt tx hash and on-chain identifiers.
- The live Sepolia execution demo routes through a deployed Safe module.
- Unsupported Sepolia venues fail closed with an explicit reason.

## Claims This Repository Does Not Prove by Default

- generalized Sepolia USDY execution against a canonical third-party venue
- universal cross-protocol execution for arbitrary assets
- mainnet deployment by default
- fully deployed policy-registry / execution-guard / receipt-registry addresses in the current checked-in Sepolia manifest
