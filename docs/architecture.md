# System Architecture

StableSync MCP is built using a modern, decentralized micro-architecture designed for maximum speed, security, and developer interoperability. It bridges raw blockchain opportunities, traditional macroeconomic indicators, and institutional flow data into a unified, agent-driven interface.

---

## 🏗️ Structural Overview

The platform consists of four primary layers:
1. **Frontend Dashboard:** A Vite React Single Page Application (SPA) leveraging premium glassmorphism aesthetics and EIP-1193 wallet integration.
2. **Backend & MCP Server:** A unified Cloudflare Worker acting as both a REST API for the frontend and a Model Context Protocol (MCP) Server for AI agents over Server-Sent Events (SSE).
3. **Database & Cache Layer:** Cloudflare D1 (SQLite) for persistent decision records and Cloudflare KV for indexing caching metrics.
4. **On-Chain Registry (Mantle Network):** A Solidity benchmark contract that acts as an immutable ledger for AI decisions.

```mermaid
graph TB
    subgraph Frontend [Client Layer: Vite React]
        UI[StableSync Dashboard]
        WC[Wallet Provider: EIP-1193]
        MC[MCP Connection Modal]
    end

    subgraph Backend [Server Layer: Cloudflare Worker]
        API[REST API /api/*]
        MCP[MCP SSE Server /mcp]
        KV[(Cloudflare KV)]
        D1[(Cloudflare D1 Database)]
    end

    subgraph External [Data Providers]
        DL[DefiLlama API]
        FR[FRED Treasury API]
        NS[Nansen Smart Money API]
    end

    subgraph Blockchain [Mantle Sepolia Network]
        SC[StableSyncDecisionBenchmark.sol]
    end

    %% Interactions
    UI -->|HTTP GET/POST| API
    UI -->|EIP-1193 Signatures| SC
    WC -->|Web3 Connection| UI
    MCP <-->|SSE Protocol| Agent[LLM AI Agent]
    
    API -->|Read/Write Decisions| D1
    API -->|Cache Queries| KV
    
    API -->|Fetch Yields| DL
    API -->|Fetch T-Bill Rates| FR
    API -->|Smart Money Flows| NS

    style UI fill:#222,stroke:#DFF651,stroke-width:2px,color:#fff
    style MCP fill:#111,stroke:#DFF651,stroke-width:1px,color:#fff
    style SC fill:#1b1b1b,stroke:#00F0FF,stroke-width:2px,color:#fff
    style D1 fill:#1a1a1a,stroke:#8A2BE2,stroke-width:1px,color:#fff
```

---

## 🔌 API & Integration Protocol

To achieve a clean separation of concerns:
* **The Frontend** communicates with the Backend via standard JSON over HTTP REST endpoints (`/api/*`).
* **AI Agents** communicate with the Backend using the **Model Context Protocol (MCP) over Server-Sent Events (SSE)** at `/mcp`. Under the hood, a Cloudflare Durable Object (`StableSyncMcpAgent`) manages stateful SSE channels.
* **Smart Contracts** are triggered directly from the frontend using the user's connected Web3 wallet (MetaMask, Rabby, etc.) targeting the **Mantle Sepolia Testnet** (Chain ID `5003`).

---

## 🗄️ Caching and Resilience Strategy

To remain highly responsive during hackathon presentations and avoid third-party API rate-limits:
1. **DefiLlama Service:** Cached in Cloudflare KV for **5 minutes** (300 seconds). If cache misses, the worker fetches all yields from `https://yields.llama.fi/pools`, filters for Mantle pools, and stores them back in KV.
2. **FRED macroeconomic data:** Cached in Cloudflare KV for **1 hour** (3600 seconds) since Treasury Bill interest rates fluctuate slowly. Falls back dynamically across the 5 most recent observations if holidays return null values.
3. **Nansen Flow Signal:** Cached in Cloudflare KV for **10 minutes** (600 seconds). Gracefully disables smart money signals and returns structured fallbacks if API keys are not configured.
