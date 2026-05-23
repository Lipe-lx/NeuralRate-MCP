# NeuralRate MCP Documentation Portal

Welcome to the official documentation portal for **NeuralRate MCP** — a verifiable RWA yield intelligence layer for autonomous agents built for the **Mantle Network**.

NeuralRate MCP bridges decentralized finance (DeFi), institutional-grade risk models, and Large Language Model (LLM) agents via the **Model Context Protocol (MCP)**, while providing an operator-facing benchmark terminal and a non-custodial **per-user vault automation path** on Mantle Sepolia with explicit wallet-ownership handoff.

---

## 📂 Document Navigation

Select a document below to explore the technical details of the NeuralRate MCP implementation:

```mermaid
graph TD
    A[README.md] --> B[architecture.md]
    A --> C[mcp-server.md]
    A --> D[smart-contract.md]
    A --> E[frontend.md]
    A --> F[database.md]

    style A fill:#DFF651,stroke:#333,stroke-width:2px,color:#000
```

### [1. System Architecture (`docs/architecture.md`)](architecture.md)
Comprehensive outline of the micro-architecture, describing the connection between the Vite React frontend, the Cloudflare Worker backend, the executor service, the D1 SQLite Database, and the Mantle Sepolia smart contract.

### [2. Cloudflare Worker & MCP Server (`docs/mcp-server.md`)](mcp-server.md)
Detailed specification of the Model Context Protocol (MCP) server running inside the Worker. Documents the 7 active MCP tools, their JSON schemas, parameters, caching strategy, the **6-factor Risk Assessment Model**, and the **Optimal Allocation Algorithm**.

### [3. Smart Contract (`docs/smart-contract.md`)](smart-contract.md)
Technical details of the Solidity benchmark registry contract `NeuralRateDecisionBenchmark.sol` deployed on the Mantle Sepolia Network, detailing variables, modifiers, external functions, events, and performance tracking.

### [4. Frontend Benchmark Terminal (`docs/frontend.md`)](frontend.md)
Documentation of the Vite React user interface, details on the glassmorphism layout design system, the dynamic components (`YieldScanner`, `RiskPanel`, `NansenRadar`, `VaultPanel`, `WalletOwnershipModal`, `AgentSettingsPanel`, `DecisionLedger`), the **EIP-1193 Mantle Sepolia wallet connection hook**, the dedicated vault flow, the ownership handoff, and the MCP integration modal.

### [5. D1 Database Schema (`docs/database.md`)](database.md)
Database schema definition for the SQLite Cloudflare D1 instance. Focuses on the structural layout of logged decisions, historical yield metrics, and settlement details.

---

## 🛠️ Tech Stack at a Glance

* **Backend / MCP Server:** Cloudflare Workers, TypeScript, `@modelcontextprotocol/sdk`
* **Database & Cache:** Cloudflare D1 (SQLite), Cloudflare KV Namespace
* **Executor / Automation:** Node.js, TypeScript, vault-scoped policy orchestration, managed signer adapter
* **Frontend:** Vite, React, TypeScript, Vanilla CSS (OKLCH, Glassmorphism), EIP-1193, Biconomy AbstractJS
* **Smart Contracts:** Solidity `^0.8.20`, Hardhat, Ethers, Mantle Sepolia Testnet (Chain ID 5003)
* **DeFi Integrations:** DefiLlama Yields API, FRED (Federal Reserve Economic Data) API, Nansen Smart Money API
