# Model Context Protocol (MCP) Server

The NeuralRate MCP Server runs inside a Cloudflare Worker and exposes a stateful Model Context Protocol interface at `/mcp` over Server-Sent Events (SSE) using a Cloudflare Durable Object (`NeuralRateMcpAgent`). 

It also houses the core quantitative logic of our **6-factor Risk Assessment Model** and **Optimal Allocation Strategy**.

---

## 🛠️ MCP Tools Reference

The server implements **7 functional tools** registered in the MCP SDK:

### 1. `yield_scan`
Scans Mantle DeFi pools for current APY and TVL via DefiLlama.
* **Input Schema:**
  * `minTvlUsd` *(number, optional, default: 100000)*: Minimum TVL in USD to filter by.
  * `chainFilter` *(string, optional, default: "Mantle")*: Target chain.
* **Output:** JSON containing the **top 10 pools** sorted by TVL descending.

### 2. `tbill_spread`
Calculates the spread (in basis points) between a given DeFi pool APY and the real-time US 3-Month Treasury Bill rate.
* **Input Schema:**
  * `apy` *(number, required)*: The APY of the DeFi pool.
* **Output:** Returns the current US T-Bill rate, spread in bps (`spreadBps`), and direction (`"premium"` or `"discount"`).

### 3. `nansen_context`
Fetches Smart Money inflows/outflows for a specific token symbol/address.
* **Input Schema:**
  * `tokenAddress` *(string, required)*: The contract address of the token to inspect.
  * `chain` *(string, optional, default: "mantle")*: Network.
* **Output:** Real-time Smart Money inflows/outflows in USD and holder distribution metrics (if Nansen API key is configured).

### 4. `risk_assess`
Performs a deterministic, quantitative 6-factor risk assessment on a given pool.
* **Input Schema:**
  * `protocolTvlUsd` *(number, required)*: Total Value Locked in the protocol.
  * `apy` *(number, required)*: Current APY of the pool.
  * `apyBase` *(number, optional, default: 0)*: Base APY (organic yield).
  * `apyReward` *(number, optional, default: 0)*: Reward APY (incentive).
  * `volumeUsd1d` *(number, optional, default: 0)*: 24h trading volume.
  * `volumeUsd7d` *(number, optional, default: 0)*: 7d trading volume.
  * `apyMean30d` *(number, optional, default: 0)*: 30-day mean APY.
  * `apyPct1D` / `apyPct7D` *(number, optional, default: 0)*: APY variance.
  * `ilRisk` *(string, optional, default: "no")*: Impermanent Loss risk flag (`"yes"`, `"no"`).
  * `stablecoin` *(boolean, optional, default: false)*: Is stablecoin-based.
  * `sigma` *(number, optional, default: 0)*: Volatility standard deviation.
  * `nansenSmartMoneyNetFlow` *(number, optional, default: 0)*: Nansen 24h flow.
* **Output:** Returns a total risk score `totalScore` (0-100), risk `classification` (`"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"`), and details for each factor.

### 5. `optimal_allocation`
Calculates an optimal distribution of capital across Mantle pools based on the investor's risk profile and the user's vault policy.
* **Input Schema:**
  * `ownerEoa` *(string, optional)*: Resolves the saved user policy and vault configuration from D1.
  * `amountUsd` *(number, required)*: Total amount to allocate in USD.
  * `objective` *(enum: `"preserve"`, `"income"`, `"growth"`, optional)*: High-level portfolio objective.
  * `riskProfile` *(enum: `"low"`, `"medium"`, `"high"`, required)*: Risk profile.
  * `horizonHours` *(number, optional, default: 24)*: Investment horizon.
  * `allowedAssets[]`, `allowedProtocols[]` *(optional)*: User allowlists.
  * `maxProtocolWeightBps`, `maxAssetWeightBps`, `maxActionUsd` *(optional)*: Concentration and action caps.
  * `stableOnly` *(boolean, optional)* and `restrictionPreset` *(optional)*: User-facing restriction controls.
  * `minSpreadOverTbillBps` *(optional)*: Minimum yield premium over the 3M T-Bill.
  * `automationMode` *(optional)*: `recommend-only` or `auto-within-limits`.
* **Output:** Returns allocated amounts, target pools, blended APY, T-Bill spread, applied constraints, rationale, and whether the recommendation fits the user's automation limits.

### 6. `log_decision`
Logs a decision/recommendation to the persistent database.
* **Input Schema:**
  * `decisionId` *(string, required)*, `agentAddress` *(string, required)*, `predictedApyBps` *(number, required)*, `riskProfile` *(string)*, `allocationJson` *(string)*, `userId` *(optional)*, `vaultId` *(optional)*, `policyVersion` *(optional)*, `objective` *(optional)*, `automationMode` *(optional)*, etc.
* **Output:** JSON signaling success or failure. This persists the **local benchmark record** in D1; optional on-chain benchmark registration is handled separately by the frontend.

### 7. `get_decisions`
Fetches historical logged decisions.
* **Input Schema:**
  * `limit` *(number, optional, default: 50)*: Maximum number of records to retrieve.
  * `ownerEoa` *(string, optional)*: Scope historical decisions to a single user vault journey.
* **Output:** An array of historical decision objects.

---

## 🧮 Quantitative Risk Assessment Model (Deterministic 6-Factor)

The core evaluation logic in `risk_assess` scores pools on a scale of **0 to 100 points**:

```
TOTAL SCORE = TVL + Volume/TVL + APY Sustain + Yield Comp + Asset Exposure + Nansen Flow
```

```
Risk Classifications:
  - 80 to 100: "LOW" Risk
  - 60 to 79:  "MEDIUM" Risk
  - 40 to 59:  "HIGH" Risk
  - Under 40:  "CRITICAL" Risk
```

The mathematical formulas for each factor are documented below:

### Factor 1: TVL Depth & Liquidity (Max 20 Points)
Measures the depth of liquidity to assess protocol stability. Capped logarithmic scaling:
* $\text{TVL} \ge \$100\text{M} \implies 20\text{ pts}$
* $\text{TVL} \ge \$10\text{M} \implies 16 + \frac{\text{TVL} - 10\text{M}}{90\text{M}} \times 4\text{ pts}$
* $\text{TVL} \ge \$1\text{M} \implies 10 + \frac{\text{TVL} - 1\text{M}}{9\text{M}} \times 6\text{ pts}$
* $\text{TVL} \ge \$100\text{k} \implies 3 + \frac{\text{TVL} - 100\text{k}}{900\text{k}} \times 7\text{ pts}$
* $\text{TVL} < \$100\text{k} \implies \frac{\text{TVL}}{100\text{k}} \times 3\text{ pts}$

### Factor 2: Volume/TVL Utilization Ratio (Max 15 Points)
Scores capital efficiency and exit liquidity:
* **For DEX Pools (Trading Volume is Present):**
  * $\text{Ratio} \in [1\%, 50\%] \implies 15\text{ pts}$ (Healthy, optimal activity)
  * $\text{Ratio} \in (50\%, 100\%] \implies 10 - \frac{\text{Ratio} - 50}{50} \times 5\text{ pts}$ (Moderate risk, high turnover)
  * $\text{Ratio} > 100\% \implies \max(0, 5 - \frac{\text{Ratio} - 100}{100} \times 5)\text{ pts}$ (Highly volatile, possible wash trading)
  * $\text{Ratio} < 1\% \implies \text{Ratio} \times 10\text{ pts}$ (Illiquid pool)
* **For Lending Pools (Trading Volume is Null):**
  * Evaluated via depth proxy:
    * $\text{TVL} \ge \$10\text{M} \implies 15\text{ pts}$
    * $\text{TVL} \ge \$1\text{M} \implies 12\text{ pts}$
    * $\text{TVL} < \$1\text{M} \implies 8\text{ pts}$

### Factor 3: APY Sustainability & Volatility (Max 20 Points)
Checks absolute yields and volatility deviation against historical means:
* **Sub-factor A: Absolute Sustainability (Max 10 Points):**
  * $\text{APY} \le 10\% \implies 10\text{ pts}$ (Highly sustainable)
  * $\text{APY} \le 20\% \implies 8\text{ pts}$
  * $\text{APY} \le 50\% \implies 5 - \frac{\text{APY} - 20}{30} \times 3\text{ pts}$
  * $\text{APY} > 50\% \implies \max(0, 2 - \frac{\text{APY} - 50}{50} \times 2)\text{ pts}$ (High speculative risk)
* **Sub-factor B: Volatility Deviation & Standard Deviation (Max 10 Points):**
  * Calculates deviation from 30d mean: $\text{dev} = \frac{|\text{APY} - \text{Mean}|}{\text{Mean}}$
  * $\text{dev} > 0.5 \implies 3\text{ pts}$
  * $\text{dev} > 0.3 \implies 6\text{ pts}$
  * $\text{dev} > 0.1 \implies 8\text{ pts}$
  * $\text{dev} \le 0.1 \implies 10\text{ pts}$
  * *Volatility Penalty:* If standard deviation ($\sigma$) $> 10 \implies -3\text{ pts}$ penalty; if $\sigma > 5 \implies -1\text{ pt}$ penalty (capped at 0).

### Factor 4: Yield Composition (Max 15 Points)
Assesses the share of organic (swap fees, borrowing interest) vs. speculative yield (inflationary token rewards):
* Ratio of organic yield: $\text{ratio} = \frac{\text{apyBase}}{\text{apyBase} + \text{apyReward}}$
* $\text{ratio} \ge 0.8 \implies 15\text{ pts}$
* $\text{ratio} \ge 0.5 \implies 10 + \frac{\text{ratio} - 0.5}{0.3} \times 5\text{ pts}$
* $\text{ratio} \ge 0.2 \implies 5 + \frac{\text{ratio} - 0.2}{0.3} \times 5\text{ pts}$
* $\text{ratio} < 0.2 \implies \text{ratio} \times 25\text{ pts}$

### Factor 5: IL Risk & Asset Exposure (Max 15 Points)
Calculates risk of asset divergence and impermanent loss:
* Stablecoin pool $\implies 15\text{ pts}$ (No IL risk, peg stability)
* Non-stablecoin pool with no IL (`ilRisk: "no"`) $\implies 12\text{ pts}$ (Single-sided staking)
* Non-stablecoin pool with IL (`ilRisk: "yes"`) $\implies 5\text{ pts}$ (High asset correlation variance)
* Unknown flag $\implies 8\text{ pts}$

### Factor 6: Institutional Flow Signal (Max 15 Points)
Incorporates real-time Nansen Smart Money 24-hour flows:
* $\text{Flow} > \$500\text{k} \implies 15\text{ pts}$
* $\text{Flow} > \$100\text{k} \implies 12\text{ pts}$
* $\text{Flow} > \$0 \implies 10\text{ pts}$
* $\text{Flow} > -\$100\text{k} \implies 7\text{ pts}$
* $\text{Flow} \le -\$100\text{k} \implies 3\text{ pts}$

---

## 🎯 Optimal Capital Allocation Strategy

The allocation calculator (`optimal_allocation`) fetches the top 5 largest pools on Mantle (TVL $\ge \$100\text{k}$) and distributes capital based on the user's risk preference:

1. **Low Risk Profile:**
   * **80%** allocated to the deepest pool (safest, Top 1 by TVL).
   * **20%** allocated to the second deepest pool (Top 2 by TVL).
2. **Medium Risk Profile:**
   * **50%** allocated to the deepest pool (Top 1 by TVL).
   * **50%** allocated to the second deepest pool (Top 2 by TVL).
3. **High Risk Profile:**
   * **70%** allocated to the highest APY pool within the top 5.
   * **30%** allocated to the second highest APY pool within the top 5.

The engine calculates the final blended APY and the net basis-points spread over real-world US Treasury yields using live data.
