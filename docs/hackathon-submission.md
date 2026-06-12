# Hackathon Submission Pack

**Status:** Canonical doc

This file is intentionally factual. It describes the current codebase behavior and demoable scope, not future intent.

## One-Liner

NeuralRate MCP is a Mantle Sepolia worker and MCP server that anchors per-user vault policy on-chain, records decision receipts on-chain, and dispatches real Safe-module execution jobs under owner-approved automation scope.

## What the Demo Actually Shows

1. The user connects a wallet on Mantle Sepolia.
2. The web app bootstraps a dedicated user vault through the worker and includes the ownership review in that signed mutation.
3. The user runs one guided authorization action that publishes the on-chain policy, signs the canonical automation grant, and activates the Safe7579/ERC-4337 runtime.
4. The worker stores the grant and creates a short-lived MCP scoped session.
5. Safe runtime setup uses the canonical AA path; admin module changes are batched when setup is required.
6. Funding is optional and is reflected from live on-chain balance telemetry; production UX uses direct vault deposits rather than a funding-intent step.
7. A decision can be logged locally and queued for an on-chain receipt.
8. The executor anchors the referenced snapshot and writes the receipt transaction on-chain.
9. The preserved live execution demo can queue a real `MNT` transfer through the Safe module for operator testing, but it is not exposed as a production onboarding CTA.

## Final-Week Proof Checklist

Before submitting, capture a fresh proof bundle from the live environment:

- public MCP `/mcp` tools list showing only the five read-only advisory tools
- scoped state MCP `get_execution_readiness` returning `ready`
- active on-chain policy or policy publication transaction hash
- latest successful execution or receipt transaction hash
- screenshot of the verify page or operator history showing the same identifiers

Do not reuse stale failed or blocked jobs as the main evidence trail. If a live execution is intentionally skipped, document the reason and submit readiness plus policy proof as the fallback evidence.

## Architecture Slide

- **Worker**
  Public REST and MCP surface. Validates auth, stores indexed state, issues grants and sessions, and queues jobs.
- **Executor**
  Internal service. Resolves on-chain policy, anchors snapshots, and submits receipt or vault-module transactions.
- **Web**
  User/operator panel. Shows state and gathers signatures.
- **Receipt registry**
  `NeuralRateDecisionReceiptRegistry.sol` on Mantle Sepolia, fully synchronized in the deployment manifest.
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
- `mock-usdy-sepolia-allocation`
  - explicit Mantle Sepolia demo harness
  - routes wallet-held Mock USDY through the same Safe module ERC-20 execution path
  - funding can be initiated from the Vault UI Mock USDY Faucet or prepared via MCP `prepare_mock_usdy_mint`
  - disclosed as a testnet substitute because Ondo has no canonical public Mantle Sepolia USDY deployment; mainnet uses Ondo's canonical USDY contract

## Claims That Match the Current Code

- The MCP server exposes a public read-only catalog plus scoped mutation catalogs.
- User policy and vault state are persisted in D1 and mirrored on-chain for the active automation policy.
- The worker issues automation grants and short-lived scoped sessions.
- Decision receipt writes are real Mantle Sepolia transactions in the new contract path.
- The worker stores the resulting receipt tx hash and on-chain identifiers.
- The live Sepolia execution demo routes through a deployed Safe module.
- Unsupported Sepolia venues fail closed with an explicit reason.
- Mock USDY execution is labeled separately from canonical USDY execution.

## Claims This Repository Does Not Prove by Default

- generalized Sepolia USDY execution against a canonical third-party venue
- universal cross-protocol execution for arbitrary assets
- mainnet deployment by default
