# Hackathon Submission Pack

## Positioning

**NeuralRate MCP is the AI trust and execution layer for policy-constrained RWA allocation on Mantle.**

Instead of acting like a generic yield router, NeuralRate combines wallet-signed user control, a dedicated vault per user, policy-aware execution, MCP-native agent access, and an on-chain benchmark registry that turns AI recommendations into verifiable records.

## One-Liner

NeuralRate MCP helps AI agents allocate into Mantle RWA and stable yield opportunities with signed user consent, vault-scoped policies, and benchmarkable on-chain decision records.

## Demo Scope

The official demo path is intentionally narrow:

1. User connects a wallet on Mantle Sepolia.
2. User bootstraps a dedicated vault.
3. User signs policy and automation consent.
4. NeuralRate scans yields and filters candidates to a stable / RWA-safe profile.
5. NeuralRate highlights a USDY-oriented allocation thesis.
6. The operator can queue the dedicated USDY stable demo job from the vault panel.
7. The benchmark decision is written on-chain.
8. The UI shows the local record, tx hash, on-chain decision id, consent audit trail, and execution trail.

## Architecture Slide

- `Web app`: user-facing benchmark terminal and vault control surface
- `Worker`: signed-mutation API, MCP tools, D1 persistence, cached market data
- `Executor`: signed-consent verification, benchmark writer, vault job orchestration
- `Benchmark contract`: public Mantle Sepolia registry for decision performance tracking
- `USDY strategy adapter`: repo-pinned execution surface deployed on Mantle Sepolia and validated by runtime bytecode hash
- `Trust split`: user wallet controls consent; NeuralRate benchmark identity stays separate from user funds

## Trust Model Slide

- Every state-changing user mutation is protected by `nonce + wallet signature`.
- Browser actions are authorized by the wallet owner, not by a frontend-only session.
- Nonces are short-lived and single-use to prevent replay.
- Signed consent is stored separately from optional on-chain grant execution.
- Benchmark writes capture `txHash`, parse the real `DecisionCreated` event, and persist the on-chain id locally.
- The USDY strategy path resolves only through a repo-pinned deployment manifest and runtime bytecode validation.
- User vault execution and global benchmark identity are intentionally separated to reduce blast radius.

## 60-90s Demo Script

“NeuralRate is the trust and execution layer for AI-managed RWA allocation on Mantle. Here the user connects a wallet and bootstraps a dedicated vault, so their funds are not mixed with any shared agent balance. Next, the user signs a policy-constrained consent message. That signature is verified server-side with a nonce, stored as an audit record, and can later be revoked by the same wallet owner.

Now NeuralRate scans Mantle yield opportunities and focuses the policy to stable and RWA-safe candidates. In this demo we intentionally keep the scope narrow and choose a USDY-oriented thesis. When the benchmark is submitted, the executor writes the decision to Mantle Sepolia, waits for confirmation, parses the real `DecisionCreated` event, and stores both the tx hash and the on-chain decision id back into the ledger.

So the result is not just an AI recommendation. It is a signed, policy-scoped, benchmarkable decision trail that can be audited across the UI, the backend ledger, and the chain.” 

## Feature Matrix

| Capability | NeuralRate MCP | Generic AI Yield Router |
| --- | --- | --- |
| MCP-native agent interface | Yes | Usually no |
| Wallet-signed user mutations | Yes | Rare |
| Dedicated vault per user | Yes | Often shared or abstracted |
| Signed consent audit trail | Yes | Rare |
| On-chain benchmark registry | Yes | Rare |
| Local-to-chain decision traceability | Yes | Rare |
| Per-user policy controls | Yes | Sometimes partial |
| Narrow institutional trust model | Yes | Usually pitch-level only |

## Claims Checklist

Use these claims in the submission only if the deployed environment still matches them:

- Wallet-signed authorization is required for state-changing user actions.
- Signed consent is recorded and visible in the UI.
- Benchmark writes produce a real Mantle Sepolia transaction hash.
- The ledger stores the real on-chain decision id parsed from the contract event.
- User vault scope is separated from the global benchmark writer identity.
- The USDY strategy adapter is pinned by `address + runtime bytecode hash`, not discovered dynamically at runtime.

Avoid stronger claims unless they are live and demonstrable:

- “Fully autonomous multi-strategy vault execution”
- “Generalized cross-protocol execution engine”
- “On-chain grant execution for every session”
