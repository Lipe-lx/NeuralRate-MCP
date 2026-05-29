# NeuralRate Improvement Plan

## Purpose

This document turns the current product evaluation into an execution plan grounded in the repository as it exists today.

Primary goals:

1. strengthen public verifiability
2. reduce onboarding friction
3. clarify positioning
4. improve production readiness
5. harden trust, privacy, and release discipline

## Current Snapshot

What was reviewed:

- `apps/web`
- `apps/worker`
- `apps/executor`
- `contracts`
- `deployments`
- `docs`
- root manifests and public assets

Current technical baseline:

- `apps/worker` tests pass
- `apps/executor` tests pass
- `contracts` tests pass
- `apps/web` production build passes
- web build emits dependency warnings from `@privy-io/react-auth` during Rolldown/Vite bundling

## Key Findings From The Codebase

These items materially affect the evaluation and should drive priority:

1. Public docs are not actually being published in a crawler-friendly way.
   - `apps/web/public/llms.txt` links to `/docs/*.md`
   - `apps/web/public` does not contain a `docs/` directory
   - `apps/web/vite.config.ts` has no copy/sync step for repo docs

2. The public “source of truth” is inconsistent across surfaces.
   - `README.md` still references the legacy benchmark address `0xc515...`
   - `apps/web/src/config.ts` also defaults to the legacy benchmark address
   - `deployments/mantle-sepolia.json`, `apps/worker/wrangler.toml`, and `apps/worker/.dev.vars.example` use the newer `NeuralRateDecisionReceiptRegistry` address `0xC0C8...`

3. Verifiability exists in architecture, but not yet in public audit UX.
   - risk scoring logic is deterministic in `apps/worker/src/mcp/tools.ts`
   - factor explanations exist in `apps/web/src/components/RiskPanel.tsx`
   - snapshot anchoring exists on-chain in `contracts/contracts/NeuralRatePolicyRegistry.sol`
   - but frontend/demo flows still use `local-snapshot:${hash}` and `buildLocalSnapshotHash(...)` in `apps/web/src/lib/policyRegistry.ts` and `apps/web/src/hooks/useNeuralRateUser.ts`

4. The product is still tightly framed around Mantle Sepolia.
   - chain id `5003` is hardcoded throughout `apps/web`, `apps/worker`, `apps/executor`, and `contracts`
   - several scripts and messages are explicitly locked to Mantle Sepolia

5. The onboarding path is intentionally secure, but operationally heavy.
   - current flow spans bootstrap, funding intent, ownership ack, policy publish, grant challenge, grant signature, grant issuance, and module/runtime enablement
   - this is spread across `apps/web/src/hooks/useNeuralRateUser.ts`, `apps/web/src/lib/automation.ts`, `apps/worker/src/automationControl.ts`, and the contracts

6. Some user-state endpoints are publicly queryable by `ownerEoa` without signed auth.
   - examples in `apps/worker/src/index.ts`:
     - `GET /api/agent-config`
     - `GET /api/vault`
     - `GET /api/benchmark/history`
     - `GET /api/automation/state`
   - this may be acceptable for a demo, but it is not a strong privacy posture for production

## Priority Order

- `P0`: trust, docs, public truth consistency
- `P1`: onboarding simplification and product positioning
- `P2`: production readiness, chain abstraction, observability
- `P3`: polish, packaging, and secondary improvements

## P0 - Public Verifiability And Truth Consistency

### Goal

Make the public claim of “verifiable” true without requiring source-code archaeology.

### To-Do

- [x] Publish the canonical markdown docs as real public files under the site.
  - Suggested implementation:
    - copy selected files from root `docs/` into `apps/web/public/docs/` at build time
    - keep `llms.txt` links valid
  - Files involved:
    - `apps/web/public/llms.txt`
    - `apps/web/vite.config.ts`
    - `apps/web/package.json`
    - `docs/*.md`

- [x] Create a public `Verification` page with:
  - live contract addresses
  - chain id
  - current agent id
  - MCP endpoint
  - latest deployment timestamps
  - links to Mantlescan and agent metadata
  - sources:
    - `deployments/*.json`
    - `agent-card.json`
    - `apps/worker/wrangler.toml`

- [x] Consolidate deployment truth so every public surface uses the same addresses.
  - Update legacy references in:
    - `README.md`
    - `apps/web/src/config.ts`
    - any stale docs pointing to the old benchmark contract
  - Define one canonical source:
    - `deployments/*.json` for checked-in addresses

- [x] Publish the deterministic risk model as a formal spec.
  - Explain the six factors, thresholds, and formulas from:
    - `apps/worker/src/mcp/tools.ts`
    - `apps/web/src/components/RiskPanel.tsx`
  - Include at least three worked examples with exact inputs and outputs
  - Add a “model version” field and changelog

- [x] Make data lineage auditable.
  - Replace or supplement `local-snapshot:${hash}` with durable public evidence
  - store and expose:
    - raw inputs used for scoring/allocation
    - hash derivation method
    - optional IPFS/public blob pointer for snapshot payload
  - Files involved:
    - `apps/web/src/lib/policyRegistry.ts`
    - `apps/web/src/hooks/useNeuralRateUser.ts`
    - `apps/web/src/components/DecisionLedger.tsx`
    - `apps/executor/src/onchainPolicy.ts`
    - `apps/executor/src/benchmarkExecutor.ts`

### Definition Of Done

- `llms.txt` links resolve to real markdown
- public docs explain the exact risk formula
- public addresses are consistent everywhere
- a third party can trace a decision from UI input to snapshot hash to on-chain receipt

## P1 - Positioning And Product Shape

### Goal

Make it obvious who the product is for and what the main use case is.

### To-Do

- [x] Separate marketing, docs, and operator surfaces.
  - Suggested IA:
    - `/` = positioning and product narrative
    - `/app` = terminal + vault panel
    - `/docs` = technical docs
    - `/verify` = audit/deployment proof

- [x] Choose and state a primary persona.
  - Recommended options to resolve internally:
    - yield operator with automation guardrails
    - agent-builder integrating an MCP execution surface
    - end-user vault automation operator
  - Reflect the choice in:
    - homepage copy
    - nav labels
    - docs order
    - `agent-card.json` description

- [x] Reduce mixed messaging in UI copy.
  - Current UI blends:
    - benchmark terminal
    - agent access
    - personal vault automation
    - infra/platform language
  - Review:
    - `apps/web/src/App.tsx`
    - `apps/web/src/components/Header.tsx`
    - `apps/web/src/components/VaultPanel.tsx`
    - `apps/web/src/components/McpConnectModal.tsx`

- [x] Decide whether the public story is:
  - “yield intelligence terminal with optional automation”
  - or “agent-safe automation infrastructure with a built-in terminal”
  - then rewrite the homepage and docs intro accordingly

### Definition Of Done

- a new visitor can identify the primary persona in under 30 seconds
- the public site no longer tries to explain four products at once

## P1 - Onboarding And Activation Friction

### Goal

Preserve security guarantees while reducing the number of steps the user must understand.

### To-Do

- [x] Collapse the vault setup into a guided checklist with a single primary CTA.
  - Current flow spans too many conceptual states
  - add progressive disclosure instead of exposing the full security model up front

- [x] Turn the bootstrap/funding/ack/grant/module process into a stepper.
  - step 1: connect wallet
  - step 2: create vault
  - step 3: fund vault
  - step 4: confirm ownership
  - step 5: enable automation
  - step 6: run first strategy
  - Main code:
    - `apps/web/src/hooks/useNeuralRateUser.ts`
    - `apps/web/src/components/VaultPanel.tsx`
    - `apps/web/src/components/WalletOwnershipModal.tsx`

- [x] Precompute and explain what each signature is for.
  - mutation auth signature
  - automation grant signature
  - on-chain policy publish transaction
  - Safe/module enable transaction

- [x] Add a “recommend-only” fast path that does not require vault setup.
  - let users experience value before funding or granting execution
  - keep automation behind a second activation milestone

- [x] Revisit grant defaults.
  - current frontend default domains exclude `config` from `DEFAULT_AUTOMATION_DOMAINS`
  - validate whether this is intentional or confusing in the UX

- [x] Add failure-state copy for the common stuck cases.
  - no funds
  - wrong chain
  - missing module
  - grant expired
  - policy not published
  - bundler/signer not execution-capable

### Definition Of Done

- first-time user can reach useful value without learning the entire trust model first
- automation enablement is expressed as a guided flow, not a raw control panel

## P2 - Production Readiness

### Goal

Move from ambitious demo/server toward a production-grade release track.

### To-Do

- [x] Introduce environment profiles for:
  - `demo`
  - `staging`
  - `production`
  - stop using Sepolia-specific defaults as the only public truth

- [x] Remove hardcoded `5003` assumptions from shared logic where possible.
  - Web:
    - `apps/web/src/config.ts`
    - `apps/web/src/hooks/useWallet.ts`
    - `apps/web/src/hooks/usePrivyWallet.ts`
  - Worker and executor:
    - `apps/worker/src/index.ts`
    - `apps/worker/src/automationControl.ts`
    - `apps/executor/src/index.ts`
    - `apps/executor/src/config.ts`
    - `apps/executor/src/onchainPolicy.ts`

- [x] Define the mainnet strategy roadmap explicitly.
  - what remains Sepolia-only
  - what is blocked by missing canonical venues
  - what contracts or integrations must be redeployed or verified first

- [x] Add release gates that validate:
  - docs links resolve
  - deployment addresses match all public surfaces
  - worker and web env defaults are aligned
  - public MCP catalog matches expected surface

- [x] Add build/test aggregation at repo root.
  - current tests are split per package
  - add a root script for repeatable validation before release

### Definition Of Done

- the repo can distinguish demo mode from production mode
- release checks catch address drift and public-doc drift before deploy

## P2 - Trust Model, Privacy, And Security Hardening

### Goal

Make the actual trust model explicit and tighten the places where the demo still assumes friendliness.

### To-Do

- [x] Publish a “Trust Assumptions” document.
  - Privy role
  - Turnkey role
  - Safe role
  - Cloudflare Worker/D1/KV role
  - executor role
  - what is on-chain enforced vs off-chain coordinated

- [x] Rework public GET endpoints that expose user state by `ownerEoa`.
  - Require signed auth or session scope for sensitive records
  - Review:
    - `/api/agent-config`
    - `/api/vault`
    - `/api/benchmark/history`
    - `/api/automation/state`
  - Main file:
    - `apps/worker/src/index.ts`

- [x] Audit what should remain public in MCP read-only tools.
  - `get_user_state`
  - `list_jobs`
  - determine whether anonymous `ownerEoa` queries should remain supported

- [x] Add threat-model notes for replay, grant expiry, revoked state, and stale snapshots.
  - existing logic is good, but not well surfaced publicly

- [x] Add tests for privacy and access boundaries.
  - anonymous state read should be intentionally allowed or intentionally blocked
  - no ambiguous middle ground

### Definition Of Done

- trust assumptions are documented in plain language
- user-state exposure is a deliberate choice backed by tests

## P2 - Observability And Operations

### Goal

Make failures diagnosable in production without reading raw logs by hand.

### To-Do

- [x] Add structured audit views for:
  - policy published
  - grant issued
  - session created
  - snapshot anchored
  - receipt created
  - strategy blocked
  - strategy executed

- [x] Add operator-facing health endpoints and dashboards.
  - worker provider health
  - executor signer capability
  - bundler health
  - MCP catalog health

- [x] Add error monitoring/reporting for web and worker.
  - especially around wallet flows, grant issuance, and on-chain publish failures

- [x] Make live audit reports part of release artifacts.
  - current repo already has useful audit docs under `docs/`
  - formalize that into a repeatable release checklist

### Definition Of Done

- a failed job or broken provider can be diagnosed from product surfaces and logs quickly

## P3 - Frontend And Packaging Polish

### Goal

Refine the experience after the trust and product fundamentals are fixed.

### To-Do

- [x] Create a dedicated docs layout instead of relying on the SPA shell
- [x] Improve empty states and progress states across terminal and vault tabs
- [x] Revisit terminology consistency:
  - `agent`
  - `vault`
  - `session`
  - `grant`
  - `policy`
  - `automation`
- [x] Investigate and suppress or document current `@privy-io/react-auth` build warnings
- [x] Add copy/export tools for:
  - MCP config
  - policy summary
  - verification bundle

## Suggested Execution Sequence

### Phase 1

- [x] publish real docs
- [x] unify addresses and public references
- [x] ship public risk-model spec
- [x] lock down or explicitly bless public user-state reads

### Phase 2

- [x] introduce `/`, `/app`, `/docs`, `/verify`
- [x] simplify onboarding into a guided stepper
- [x] add recommend-only activation path

### Phase 3

- [x] environment profiles and release gates
- [x] chain abstraction and mainnet roadmap
- [x] observability and operator health tooling

## Recommended Immediate Quick Wins

- [x] Fix `llms.txt` broken doc targets
- [x] Align benchmark contract address across `README`, web config, worker config, and deployment manifests
- [x] Publish the six-factor risk formula as a markdown doc this sprint
- [x] Decide whether anonymous `ownerEoa` state reads are acceptable; if not, close them before further public promotion

## Execution Log

- 2026-05-28:
  - Added `scripts/sync-public-docs.mjs` to mirror root markdown docs into `apps/web/public/docs`.
  - Wired docs sync into frontend build via `apps/web/package.json` (`presync-docs`, `prebuild`).
  - Updated legacy benchmark references to `0xC0C836A220D006398cdE4D5caf529196E63f81A8` in:
    - `README.md`
    - `apps/web/src/config.ts`
    - `apps/web/public/llms.txt`
  - Validated frontend build after changes.
  - Published `docs/risk-model.md` with deterministic factor formulas, thresholds, and 3 worked examples.
  - Linked risk model documentation from:
    - `docs/README.md`
    - `README.md`
    - `apps/web/public/llms.txt`
  - Re-synced public docs and validated frontend build again.
  - Closed anonymous `ownerEoa` reads for sensitive endpoints by requiring signed read auth headers (or internal token) on:
    - `/api/agent-config`
    - `/api/vault`
    - `/api/benchmark/history`
    - `/api/automation/state`
  - Added frontend signed-read helper and migrated active read flows to signed GET:
    - `apps/web/src/lib/auth.ts`
    - `apps/web/src/hooks/useNeuralRateUser.ts`
    - `apps/web/src/components/DecisionLedger.tsx`
  - Updated CORS allowlist for signed read headers in `apps/worker/src/index.ts`.
  - Validated worker tests and frontend build after the changes.
  - Added a public verification surface in the web app:
    - new `Verify` tab in `apps/web/src/App.tsx`
    - new `apps/web/src/components/VerifyPanel.tsx`
  - Extended public sync pipeline to publish verification artifacts:
    - `apps/web/public/verify/deployments.json`
    - `apps/web/public/verify/agent-card.json`
    - implemented in `scripts/sync-public-docs.mjs`
  - Added trust boundary document `docs/trust-assumptions.md` and linked it in doc indexes.
  - Added explicit threat-model notes (replay, grant expiry, revoke semantics, stale snapshot risk) in `docs/trust-assumptions.md`.
  - Hardened public MCP read-only boundary for sensitive state access:
    - `get_user_state` now requires `sessionToken`
    - `list_jobs` now requires `sessionToken`
    - updated implementation in `apps/worker/src/index.ts` and schemas in `apps/worker/src/mcp/tools.ts`
    - updated docs in `docs/mcp-server.md`
  - Updated MCP public smoke test to assert anonymous owner-only calls are rejected for:
    - `get_user_state`
    - `list_jobs`
    - file: `tests/e2e/mcp-public-smoke.mjs`
  - Re-validated worker tests and web build after boundary changes.
  - Added root public proof release gate:
    - `scripts/preflight-public-proof.mjs`
    - `npm run preflight:public`
  - Added root build/test aggregation script:
    - `npm run test:all`
  - Updated grant default domains to include `config` in `apps/web/src/hooks/useNeuralRateUser.ts`.
  - Added signature trail explanation copy in `apps/web/src/components/VaultPanel.tsx`.
  - Added guided onboarding checklist + stepper in `apps/web/src/components/VaultPanel.tsx` with explicit unblock copy for common stuck states (wrong chain, no funding intent, missing ownership review, missing grant, no first strategy run).
  - Enabled recommend-only decision generation path in `apps/web/src/components/DecisionLedger.tsx` so users can generate advisory decisions without vault bootstrap.
  - Updated decision copy to reflect recommend-first flow with optional automation milestone.
  - Implemented route-level information architecture in `apps/web/src/App.tsx`:
    - `/` positioning page
    - `/app` operator workspace
    - `/docs` dedicated technical docs layout
    - `/verify` dedicated verification surface
  - Updated persona/positioning copy to prioritize “yield intelligence terminal with optional vault automation.”
  - Reduced mixed messaging in:
    - `apps/web/src/App.tsx`
    - `apps/web/src/components/Header.tsx`
    - `apps/web/src/components/McpConnectModal.tsx`
    - `agent-card.json`
  - Added operator endpoints in `apps/worker/src/index.ts`:
    - `GET /api/health`
    - `GET /api/audit/summary?ownerEoa=...` (signed read auth required)
    - note: dashboard UI is still pending; endpoints are now available for operator tooling
  - Added canonical docs:
    - `docs/environment-profiles.md`
    - `docs/mainnet-roadmap.md`
    - `docs/observability-ops.md`
    - `docs/build-warnings.md`
  - Added release audit artifact generator:
    - `scripts/generate-release-audit.mjs`
    - `npm run release:audit`
    - sample artifact: `docs/release-audits/release-audit-2026-05-29.md`
  - Updated `docs/README.md` index with the new canonical docs.
  - Added copy/export actions in `apps/web/src/components/VerifyPanel.tsx`:
    - copy MCP config
    - copy policy summary
    - copy verification bundle
  - Fixed `App.tsx` selection expression typing issue by normalizing pools and memoizing selected pool resolution.
  - Introduced runtime profile/chain configuration primitives:
    - web config exports `ENV_PROFILE`, `MANTLE_CHAIN_ID`, `MANTLE_CHAIN_NAME`, `MANTLE_NETWORK_KEY`
    - worker `GET /api/health` now exposes `envProfile`
    - executor config now supports `NEURALRATE_ENV_PROFILE` and configurable `NEURALRATE_CHAIN_ID`
  - Replaced hardcoded web chain assumptions in:
    - `apps/web/src/hooks/useWallet.ts`
    - `apps/web/src/hooks/usePrivyWallet.ts`
    - `apps/web/src/providers/PrivyAppProvider.tsx`
  - Re-validated:
    - `apps/web` build
    - `apps/worker` tests
    - `apps/executor` tests
  - Added dedicated auth/signature smoke coverage in `apps/worker/src/auth.smoke.test.ts` for:
    - nonce -> valid signature -> success
    - replay protection
    - forged signer rejection
  - Wired smoke coverage into worker CI test script in `apps/worker/package.json`.
  - Implemented auditable decision lineage:
    - persisted `snapshotLineage` envelope inside decision rationale in `apps/web/src/components/DecisionLedger.tsx`
    - added `GET /api/decisions/:decisionId/lineage` (signed read auth) in `apps/worker/src/index.ts`
    - documented in `docs/data-lineage.md`
  - Added runtime telemetry/error reporting surface:
    - web global error + unhandled rejection capture in `apps/web/src/App.tsx`
    - ingestion endpoint `POST /api/telemetry/error` in `apps/worker/src/index.ts`
    - summary endpoint `GET /api/telemetry/summary` in `apps/worker/src/index.ts`
    - D1 migration `apps/worker/migrations/0009_telemetry.sql`
  - Extended Verify operational dashboard with health + telemetry cards in `apps/web/src/components/VerifyPanel.tsx`.
  - Continued chain abstraction by replacing hardcoded chain assumptions in:
    - `apps/web/src/hooks/useWallet.ts`
    - `apps/web/src/hooks/usePrivyWallet.ts`
    - `apps/web/src/hooks/useNeuralRateUser.ts`
    - `apps/web/src/providers/PrivyAppProvider.tsx`
    - `apps/worker/src/automation.ts`
    - `apps/worker/src/automationControl.ts`
    - `apps/worker/src/onchainState.ts`
    - `apps/executor/src/config.ts`
    - `apps/executor/src/index.ts`
    - `apps/executor/src/benchmarkExecutor.ts`
    - `apps/executor/src/onchainPolicy.ts`
    - `apps/executor/src/aaRuntime.ts`
    - `apps/executor/src/managedSigner.ts`
    - `apps/executor/src/policy.ts`
    - `apps/executor/src/executionRegistry.ts`
  - Validated `npm run preflight:public`, `apps/worker` tests, and `apps/web` build.

## Notes

This repository is stronger than a typical Web3 demo in architecture, policy thinking, and contract/test coverage. The biggest gap is not “core logic missing”; it is the distance between what the code can prove and what the public product currently makes easy to verify.
