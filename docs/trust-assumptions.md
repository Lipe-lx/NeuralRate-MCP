# Trust Assumptions

**Status:** Canonical doc

This document describes what NeuralRate currently trusts, what is enforced on-chain, and what is coordinated off-chain.

## System Boundaries

NeuralRate currently spans:

- `apps/web` (user/operator panel)
- `apps/worker` (public API + MCP + state index)
- `apps/executor` (internal dispatch)
- Mantle Sepolia contracts (policy, guard, module, receipt registry)
- third-party service providers

## On-Chain Enforcement

The following controls are on-chain and independently verifiable:

- active policy publication and revocation
  - `NeuralRatePolicyRegistry.sol`
- snapshot anchoring references
  - `anchorSnapshot(...)` in policy registry
- execution guard constraints
  - delegate, limits, replay protection, snapshot checks
  - `NeuralRateExecutionGuard.sol`
- vault module execution path
  - `NeuralRateVaultModule.sol`
- delegate UserOperation verification (ERC-7579/4337)
  - `NeuralRateDelegateValidator.sol`
  - Restricts the delegate key's execution capability to ONLY call `NeuralRateVaultModule` or the `NeuralRatePolicyRegistry` contract.
- decision receipt anchoring
  - `NeuralRateDecisionReceiptRegistry.sol`

If worker/executor state diverges, on-chain policy, delegate validator boundaries, and guard constraints still gate execution validity.

## Off-Chain Coordination

The following remains off-chain by design:

- user profile/config indexing
- automation grant/session lifecycle records
- job queueing and status indexing
- data-provider ingestion and cache

Current stores:

- Cloudflare D1
- Cloudflare KV

## Third-Party Dependencies

### Privy

Role:

- wallet/auth UX in the web app

Trust assumption:

- the wallet integration and account-link flows operate correctly

Failure impact:

- onboarding/connect UX degradation, not direct policy bypass on-chain

### Turnkey (or managed signer backend mode)

Role:

- transaction signing/execution capability for autonomous path

Trust assumption:

- signer is available and configured to expected account

Failure impact:

- job dispatch failure or degraded execution capability

### Safe

Role:

- vault account model and module execution path

Trust assumption:

- module enablement state and Safe execution semantics are correct

Failure impact:

- inability to execute or unexpected rejection when runtime assumptions are wrong

### Market Data Providers (DefiLlama, FRED, Nansen)

Role:

- analytics and recommendation inputs

Trust assumption:

- provider responses are timely and non-malicious

Failure impact:

- degraded recommendation quality; policy and guard still gate autonomous execution

## Public Read Access Policy

As of `2026-05-28`, sensitive user-state reads by `ownerEoa` require signed read auth headers (or internal token) on:

- `/api/agent-config`
- `/api/vault`
- `/api/benchmark/history`
- `/api/automation/state`

This reduces anonymous scraping of per-user state while preserving signed owner access.

## Residual Risk Notes

- Demo and production concerns are still mixed under Mantle Sepolia-first defaults.
- Snapshot payload provenance is not yet fully externalized in a durable public data plane.
- Operational trust still includes centralized infrastructure components (Cloudflare + signer provider).

## Threat Model Notes

### Replay

- mutation auth nonces are single-use and expire
- grant/session tokens are hashed at rest and can be revoked
- execution guard consumes intent hashes to block replayed executions

### Grant Expiry

- grant and session records carry explicit `expiresAt`
- owners configure one bounded authorization duration (1 hour to 12 fixed 30-day months) shared by grants, scoped MCP sessions, and on-chain policy validity
- scoped MCP catalog access is denied when session scope is invalid/expired
- execution still requires policy-valid bounds at dispatch time

### Revoke Semantics

- grant revoke transitions session state off-chain
- policy revoke clears active policy for vault on-chain
- module/runtime disable path reduces accidental residual authority

### Stale Snapshot Risk

- current execution path requires snapshot hash presence for guarded intents
- snapshot hash anchoring is on-chain verifiable
- remaining gap: public durability/lineage of full snapshot payload outside local hash context

## Change Policy

When trust assumptions change:

- update this document
- update `docs/architecture.md` if boundaries shift
- update public verification bundle fields if new proofs are exposed
