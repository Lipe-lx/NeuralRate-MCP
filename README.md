# NeuralRate MCP — Verifiable RWA Yield Intelligence on Mantle

NeuralRate MCP is a verifiable RWA yield intelligence layer for autonomous agents on the **Mantle Network**.

It leverages real-time yields data, macroeconomic indicators, and institutional orderflow signals to assess risk deterministically using a **6-factor Risk Assessment Model** and calculate optimal allocations. Built for AI-agent interoperability, NeuralRate exposes its capabilities directly to Large Language Models (LLMs) via the **Model Context Protocol (MCP)**, includes an operator-facing benchmark terminal, and now ships a **non-custodial per-user vault automation foundation** on Mantle Sepolia:

* **User control wallet for consent, ownership, and revocation**
* **Dedicated vault / smart account per user**
* **Personalized agent configuration per user**
* **Global NeuralRate benchmark identity kept separate from user funds**
* **Dedicated executor service for vault-scoped automation orchestration**

The public benchmark contract remains global, while user funds and execution policies are isolated inside a dedicated vault for each user. This prevents shared-balance blast radius and keeps recommendations scoped to the user’s own configuration.

```mermaid
graph TD
    subgraph UI [Vite React Client]
        D[Benchmark Terminal]
        W[EIP-1193 Mantle Wallet]
    end
    subgraph Backend [Cloudflare Worker]
        API[REST API Layer]
        MCP[MCP SSE Server]
        KV[(KV Cache)]
        D1[(D1 Database)]
    end
    subgraph Executor [Executor Service]
        EX[Session + Job Orchestrator]
        MS[Managed Signer Adapter]
    end
    subgraph Chain [Mantle Sepolia Network]
        SC[NeuralRateDecisionBenchmark.sol]
        USA[User Smart Account]
        ASW[Agent Smart Wallet]
    end

    D -->|REST Requests| API
    Agent[LLM Agent] <-->|MCP SSE| MCP
    D -->|Consent + Session Enablement| EX
    API -->|Persists Decisions| D1
    API -->|Read/Write Cache| KV
    EX -->|Policy + Job State| API
    EX -->|Managed Session Execution| ASW
    EX -->|Delegated Automation| USA
    ASW -->|Benchmark Writes| SC

    style UI fill:#111,stroke:#DFF651,stroke-width:2px,color:#fff
    style Backend fill:#1b1b1b,stroke:#8A2BE2,stroke-width:1px,color:#fff
    style Executor fill:#101820,stroke:#f59e0b,stroke-width:1px,color:#fff
    style Chain fill:#111,stroke:#00F0FF,stroke-width:2px,color:#fff
```

---

## 📂 Repository Layout

The project is structured as a monorepo containing the following components:

* **`/apps/worker`**: The Cloudflare Worker backend. Exposes a CORS-enabled REST API for the operator-facing web app and runs the stateful Model Context Protocol (MCP) server over Server-Sent Events (SSE). Integrates Cloudflare KV caching and D1 SQLite storage.
* **`/apps/web`**: The Vite React frontend benchmark terminal, featuring dark glassmorphism styling, custom OKLCH colors, native EIP-1193 wallet integration, per-user vault bootstrap, wallet-ownership handoff, personalized agent settings, and vault-scoped automation consent on Mantle Sepolia.
* **`/apps/executor`**: The dedicated automation service. Prepares vault-scoped permissions, tracks activation / revocation, and owns the autonomous job queue without ever holding user keys.
* **`/contracts`**: The Hardhat development workspace containing `NeuralRateDecisionBenchmark.sol`, a Solidity benchmark contract prepared for a configurable benchmark writer such as the NeuralRate agent smart wallet.
* **`/docs`**: Comprehensive, zero-speculation technical documentation of the entire platform:
  1. [System Architecture Guide](docs/architecture.md) — Structural layout, data flow, and caching strategy.
  2. [MCP Server Specifications](docs/mcp-server.md) — 7 tools definitions and the complete formulas for the 6-factor Risk Model.
  3. [Smart Contract Documentation](docs/smart-contract.md) — Functions, modifiers, variables, and events.
  4. [Frontend UI Reference](docs/frontend.md) — Component architecture, EIP-1193 Mantle Sepolia hook, and glassmorphism styling.
  5. [Database Schema](docs/database.md) — SQLite Cloudflare D1 schema columns and tables representation.

---

## ⚡ Quick Start (Local Development)

To run the full workspace locally, launch the backend and frontend services simultaneously:

### 1. Prerequisite Variables
Ensure you have a `.env` file in the root workspace configured with the required third-party API credentials:
```env
FRED_API_KEY="your_fred_api_key"
NANSEN_API_KEY="your_nansen_api_key"
VITE_PUBLIC_MANTLE_RPC_URL="https://rpc.sepolia.mantle.xyz"
VITE_PUBLIC_NEURALRATE_BENCHMARK_CONTRACT="0xc51560a5512d2A5756435d87319aeaE1bA480165"
VITE_PUBLIC_ERC8004_AGENT_ID="49"
VITE_PUBLIC_ERC8004_IDENTITY_REGISTRY="0x8004A818BFB912233c491871b3d84c89A494BD9e"
VITE_PUBLIC_EXECUTOR_BASE_URL="http://127.0.0.1:8788"
VITE_PUBLIC_NEURALRATE_AGENT_SMART_WALLET="0xYourAgentSmartWallet"
NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS="0xYourAgentSessionSigner"
VITE_PUBLIC_NEURALRATE_VAULT_PROVIDER_STRATEGY="safe-primary"
VITE_PUBLIC_NEURALRATE_ONBOARDING_PROVIDER="privy"
VITE_PUBLIC_NEURALRATE_MANAGED_SIGNER_PROVIDER="turnkey"
```

### 2. Run the Cloudflare Worker Backend
Navigate to the worker directory, install dependencies, and start Wrangler's local development server:
```bash
cd apps/worker
npm install
npx wrangler dev
```
* The backend will boot at `http://localhost:8787` (CORS headers enabled for local frontend requests).
* Exposes REST endpoints under `/api/*` and the stateful SSE agent connection stream at `/mcp`.

### 3. Run the Vite React Frontend
In a new terminal window, navigate to the web app directory, install dependencies, and launch Vite's HMR dev server:
```bash
cd apps/web
npm install
npm run dev
```
* The frontend app will open at `http://localhost:5173`.
* Standardizes to Mantle Sepolia (Chain ID `5003`).
* The benchmark terminal can run entirely on the built-in Sepolia defaults, or read the public contract / explorer / executor overrides from `apps/web/.env.example`.

### 4. Run the Executor Service
In a third terminal window, launch the automation executor:
```bash
cd apps/executor
npm install
npm run dev
```
* The executor boots at `http://localhost:8788`.
* It prepares vault-scoped permissions, persists activation state through the Worker API, and queues benchmark / execution jobs without user key custody.

---

## 🛡️ Core Features Deployed

1. **6-Factor Deterministic Risk Engine:** Evaluates protocols based on TVL, Volume utilization (detecting lending pools automatically), APY sustainability, Yield Composition (base vs reward incentives), IL risk, and Nansen Smart Money flows.
2. **Per-User Vault Isolation:** Every user gets a dedicated vault / smart account, so no user funds are pooled behind a shared agent treasury.
3. **Personalized Agent Settings:** Recommendations are ranked from global market data but filtered and capped by the user’s own vault policy, presets, allowlists, and automation limits.
4. **Vault-Scoped Automation Flow:** The frontend bootstraps a dedicated vault, performs an explicit wallet-ownership handoff, records funding intents, enables revocable automation, and keeps benchmark identity separate from execution funds.
5. **Executor-Based Benchmark Orchestration:** Decisions are generated and stored locally in D1 first, then queued into a dedicated executor that manages autonomous benchmark jobs under a revocable user-vault policy model.
6. **Agent-Access MCP Portal:** Connects AI agents directly to our DeFi tools in 1-click using SSE and standard JSON configurations.
