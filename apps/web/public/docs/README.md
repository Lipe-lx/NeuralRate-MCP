# Documentation Portal

**Status:** Canonical doc

This directory contains the current documentation split into two groups:

- **Canonical docs**
  These describe the codebase as it is implemented now.
- **Historical/derived docs**
  These remain in the repo for context, but are not the source of truth.

## Canonical Docs

- [architecture.md](architecture.md)
  Runtime topology, service boundaries, flows, cache, and trust model.
- [mcp-server.md](mcp-server.md)
  Public MCP endpoint, tool catalog, and grant/session rules.
- [database.md](database.md)
  D1 schema derived from migrations `0001` through `0008`.
- [smart-contract.md](smart-contract.md)
  Benchmark registry, vault module, and preserved USDY adapter.
- [frontend.md](frontend.md)
  Role of the web app and the current Mantle Sepolia demo surface.
- [risk-model.md](risk-model.md)
  Deterministic six-factor risk model, thresholds, formulas, and worked examples.
- [data-lineage.md](data-lineage.md)
  Decision snapshot lineage model and retrieval endpoint for third-party verification.
- [trust-assumptions.md](trust-assumptions.md)
  On-chain vs off-chain authority model, third-party dependencies, and residual risks.
- [deployment.md](deployment.md)
  Canonical deployment trigger model and release expectations.
- [environment-profiles.md](environment-profiles.md)
  Demo/staging/production profile model and release gate expectations.
- [mainnet-roadmap.md](mainnet-roadmap.md)
  Explicit path from Mantle Sepolia demo posture to production mainnet rollout.
- [observability-ops.md](observability-ops.md)
  Health and audit endpoints plus operator runbook.
- [build-warnings.md](build-warnings.md)
  Known third-party build warnings and escalation policy.
- [hackathon-submission.md](hackathon-submission.md)
  Factual submission notes aligned to the current repository state.

## Historical/Derived Docs

- [SPRINT_PLAN.md](SPRINT_PLAN.md)
- [neuralrate-mcp-consolidated.md](neuralrate-mcp-consolidated.md)
- [e2e-live-audit-2026-05-27.md](e2e-live-audit-2026-05-27.md)
- [e2e-mcp-live-audit-2026-05-27.md](e2e-mcp-live-audit-2026-05-27.md)

These files are preserved for planning history and audit context only.
