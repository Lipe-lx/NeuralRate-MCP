# Security Dependency Triage

**Status:** Canonical doc

Last checked: 2026-06-08 with:

```bash
npm audit --omit=dev --audit-level=moderate
```

Current result:

- 37 production-scope audit findings
- 30 moderate
- 4 high
- 3 critical

## Executive Summary

The current findings are concentrated in wallet, Safe, WalletConnect, Privy, Biconomy, Turnkey, ethers v5, and transitive websocket/UUID dependency chains. They do not currently indicate a known vulnerability in NeuralRate's worker authorization, scoped MCP grant model, on-chain policy checks, or executor boundary.

They still matter for judges and release readiness because they affect the frontend and crypto SDK supply chain. Treat this as a visible release-risk item, not as a reason to rewrite the integrated demo during the final hackathon week.

## Finding Groups

### `elliptic` via Safe 4337 / ethers v5

Severity: critical.

Observed chain:

- `@safe-global/safe-4337`
- `ethers`
- `@ethersproject/signing-key`
- `elliptic`

Risk posture:

- Relevant to signing/verification dependency chains.
- NeuralRate's live owner authorization uses signed envelopes and on-chain policy enforcement; avoid adding new ethers v5 signing paths.
- Do not perform broad forced upgrades during final-week freeze unless the Safe dependency line can be tested end to end.

Action:

- Prefer upstream Safe package upgrades when available.
- If the dependency remains pinned by Safe, document the residual risk and keep execution demos constrained to the already-tested Safe module path.

### `ws` via Privy, WalletConnect, Safe, ethers, and viem chains

Severity: high.

Observed issue:

- `ws` DoS and memory-disclosure advisories in transitive SDK trees.
- `npm audit` reports no complete fix for part of the dependency graph.

Risk posture:

- Browser bundles do not operate as public websocket servers, which reduces exposure for DoS-from-headers findings.
- This remains a supply-chain risk because wallet SDKs can bring websocket clients into the application bundle.

Action:

- Track upstream Privy, WalletConnect/Reown, Safe, and viem releases.
- Avoid adding custom websocket server behavior in the web app or worker.
- Re-run audit after each SDK upgrade and before mainnet hardening.

### `uuid` via MetaMask / Wagmi / WalletConnect / Biconomy chains

Severity: moderate.

Observed issue:

- Missing buffer bounds check in older `uuid` ranges.

Risk posture:

- Mostly transitive through wallet SDK convenience layers.
- Not known to affect NeuralRate's scoped MCP token generation, which uses server-side random token generation and hashes the token before storage.

Action:

- Accept for hackathon demo if no non-breaking SDK update is available.
- Upgrade transitive wallet dependencies when their top-level SDKs release compatible versions.

## Final-Week Policy

- Do not run `npm audit fix --force` during the submission freeze unless the full wallet, Safe, MCP, executor, and contract flows are retested.
- Keep demo execution paths narrow and already validated.
- Keep secrets out of the browser and Cloudflare plaintext vars.
- Keep scoped MCP tokens short-lived and prefer `x-neuralrate-session-token` over query-string tokens.
- Re-run:

```bash
npm audit --omit=dev --audit-level=moderate
npm --workspace apps/worker test
npx tsc -p apps/worker/tsconfig.json --noEmit
npm --workspace apps/web run build
```

## Mainnet Readiness Gate

Before any mainnet release, this file should be replaced by a fresh dependency review with:

- top-level SDK upgrade candidates
- explicit non-bundled versus bundled analysis
- browser bundle inspection for vulnerable code paths
- Safe execution regression test
- MCP scoped-session live smoke
- dependency lockfile diff review
