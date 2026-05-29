# Mainnet Roadmap

**Status:** Canonical doc

This roadmap defines what remains demo-only and what must be completed before a production mainnet launch.

## Current State

- active public demo target: Mantle Sepolia (`chainId: 5003`)
- contracts and flows validated for testnet-grade operation
- public verification and risk docs are available

## Gaps To Mainnet

1. Chain abstraction
- remove hardcoded Sepolia assumptions from shared web/worker/executor logic
- support profile-driven chain metadata and contract maps

2. Execution readiness
- production signer + bundler reliability SLOs
- automated failover behavior for temporary provider outages

3. Data lineage durability
- replace local snapshot-only references with durable public payload references
- publish hash derivation + retrieval path in verify surfaces

4. Operational hardening
- operator dashboards + alerting tied to health/audit endpoints
- incident response playbook for grant/session/policy failures

## Launch Phases

- Phase A: production-shaped staging
  - all release gates green
  - full policy/grant/receipt dry-runs
- Phase B: limited mainnet beta
  - restricted cohorts and capped automation limits
  - daily audit review
- Phase C: general availability
  - expanded limits and broader onboarding
  - sustained monitoring + monthly trust/model updates
