# Frontend Benchmark Terminal

The NeuralRate Frontend is built as a highly optimized Vite React SPA leveraging advanced styling tokens, responsive layouts, and zero-dependency Web3 integrations.

---

## 🎨 Design System and Aesthetics

The interface is built entirely with **Vanilla CSS** and customized inline layout systems, targeting premium cyber-aesthetics:
* **Typography:** Integrated **Google Fonts Outfit** as the primary font family for modern, clean reading.
* **Glassmorphism Panels (`.glass-panel`):** Utilizes `color-mix` with `oklch` dark-mode colors, combined with heavy `backdrop-filter: blur(16px)` and thin `oklch(100% 0 0 / 0.1)` borders for a premium depth effect.
* **Responsive Layout:** Arranged in a strict 3-column grid structure (`300px 370px 1fr`) designed to fit entirely inside the viewport (`height: 100vh`, `overflow: hidden`) with internal custom-scrollbar scrolling inside panels to prevent generic body-level scrolling.

---

## 🔌 Zero-Dependency Web3 Wallet Integration

Located in `useWallet.ts` and `WalletContext.tsx`, NeuralRate implements a native, zero-dependency **EIP-1193 Web3 provider bridge** that connects to browser wallets (MetaMask, Rabby, Coinbase, etc.):

* **Target Network:** **Mantle Sepolia Testnet**
  * Chain ID: `5003` (`0x138b` hex)
  * RPC Endpoint: `https://rpc.sepolia.mantle.xyz`
  * Block Explorer: `https://explorer.sepolia.mantle.xyz`
* **Features:**
  * **Auto Chain Check:** Displays a glowing red warn button if the wallet is on the wrong chain.
  * **Network Switcher (`switchToMantle`):** Programmatically calls `wallet_switchEthereumChain` or `wallet_addEthereumChain` to add and switch the user's browser wallet to Mantle Sepolia.
  * **Event Listeners:** Active tracking for `accountsChanged` and `chainChanged` events.

---

## 🛸 Premium Header Buttons Redesign

The top right header houses two highly polished interactive buttons:

1. **AGENT ACCESS Button (`.btn-premium-agent`):**
   * Features a pulsing green status dot (`agent-dot-active`) powered by infinite CSS keyframe scaling.
   * Houses an overlaying *gloss shimmer* animation sweep on hover.
2. **Connect Wallet Button (`.btn-premium-wallet` & `.btn-premium-connected`):**
   * *Disconnected:* Displays a cybernetic gradient border with a rotating SVG wallet icon that fills with neon green on hover.
   * *Connected:* Displays the shortened hex address (`0x...`) in monospace font with a glowing active dot. Hovering shifts the text to "Disconnect" and turns the button danger-red using smooth transitions.

---

## 🧩 Dashboard Panels

The UI is divided into four modular components:

### 1. `YieldScanner`
* **Purpose:** Displays high-yield pool opportunities on Mantle fetched directly from DefiLlama.
* **Logic:** Automatically sorts the fetched pools by **APY descending** (`b.apy - a.apy`).
* **UI:** Rendered as interactive cards with live state feedback and active green selection borders.

### 2. `RiskPanel`
* **Purpose:** Renders the quantitative breakdown of the **6-factor Risk Assessment Model** for the selected pool.
* **Logic:** Requests `/api/risk-assess` on the backend when a pool is selected, generating a color-coded classification score:
  * **`LOW` Risk:** Green text and borders.
  * **`MEDIUM` Risk:** Orange text and borders.
  * **`HIGH` / `CRITICAL` Risk:** Red text and borders.
* **Features:** Includes custom rendering for DEX vs. Lending pools (suppressing volume metrics for lending markets) and direct pool-specific links to DefiLlama yields (`/yields/pool/${pool.pool}`).

### 3. `NansenRadar`
* **Purpose:** Summarizes Smart Money flows for the selected pool's tokens.
* **Features:** Implements a graceful fallback container that guides the user on how to enable full flow features if the Nansen API key is missing.

### 4. `DecisionLedger`
* **Purpose:** Displays an ERC-8004 inspired ledger tracking the historical recommendations logged in the D1 Database.
* **Features:** 
  * **Trigger Allocation:** Simulates an allocation calculation of $10,000 (Medium Risk) on the backend and immediately logs it into D1, updating the UI. This button is active **only if the wallet is connected** and on the correct Mantle chain.
  * **Clear:** Instantly wipes the historical ledger records from the SQLite D1 database.

---

## 🌀 Agent MCP Access Modal

Accessed by clicking the **AGENT ACCESS** button:
* Opens a customized glass portal overlay (`McpConnectModal.tsx`).
* Provides a **1-click SSE connection string** (`mcp+sse://localhost:8787/mcp`) for browser-based agents.
* Offers a single-button **"Copy Config"** function that formats the standard MCP client config JSON block for tools integration.
