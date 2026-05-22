# NeuralRate MCP
### Mantle Turing Test Hackathon 2026 — Phase 2: AI Awakening

**Primary Track:** AI x RWA  
**Secondary Track:** Agentic Wallets & Economy  
**Stretch Target:** Best UI/UX  
**Positioning:** Verifiable RWA yield intelligence infrastructure for autonomous agents on Mantle.

---

# 0. Merge Summary — Main Differences Between V1 and V2

This document consolidates the strongest parts of both versions.

## 0.1 What V1 does better

V1 is stronger as a technical implementation blueprint. It includes:

| Area | V1 Strength |
|---|---|
| Prompt architecture | Clear progressive context loading model. |
| Static vs dynamic asset context | Separates manually maintained protocol facts from live market data. |
| Depeg automation | Defines how to detect price deviation events from Pyth/Chainlink feeds. |
| Data source TTLs | Gives concrete cache intervals for APY, supply, depeg and backing data. |
| Runtime prompt construction | Shows how the Worker injects only relevant asset context into the LLM. |
| Simpler MVP path | Uses a minimal decision log contract and a straightforward build plan. |

## 0.2 What V2 does better

V2 is stronger as a hackathon-grade narrative and differentiation layer. It adds:

| Area | V2 Improvement |
|---|---|
| Positioning | Moves away from “AI yield optimizer” toward “verifiable RWA yield intelligence layer.” |
| Nansen integration | Treats Nansen as a premium intelligence source, not a decorative API. |
| Deterministic scoring | Makes risk scoring deterministic, with the LLM used only for synthesis/explanation. |
| On-chain benchmarking | Adds `DecisionCreated` and `DecisionSettled`, turning recommendations into measurable predictions. |
| Benchmark dashboard | Adds predicted vs realized APY, error bps and T-bill outperformance. |
| Data snapshots | Adds `dataSnapshotHash`, prompt version, model version and scoring version. |
| Risk mitigation | Explicitly addresses demo risk, Nansen downtime, hallucination and UI sameness. |
| Submission narrative | Provides clearer pitch, tagline and final positioning for judges. |

## 0.3 Final merge decision

The consolidated version uses:

- V2 as the main narrative, structure and competitive positioning.
- V1 as the technical backbone for prompt architecture, data refresh, depeg detection and cache design.
- V2's benchmarking contract instead of V1's simpler decision log.
- V2's Nansen strategy, but with V1's fallback and source-specific data architecture.
- A more structured implementation plan that can be directly converted into a GitHub README, DoraHacks submission, pitch script or technical spec.

---

# 1. Executive Summary

Yield-bearing stablecoins and RWA-backed assets on Mantle create a strong opportunity for autonomous agents: they can monitor liquidity, yield spreads, depeg signals, smart money movement, protocol-level risk and Treasury benchmark spreads faster than human users or static dashboards.

However, the hackathon space is saturated with generic “AI yield optimizer” concepts. **NeuralRate MCP** is intentionally positioned differently: it is not just a frontend that recommends the highest APY. It is a **Model Context Protocol server that gives autonomous agents a verifiable yield reasoning layer**.

The server exposes callable MCP tools for:

- Scanning Mantle yield venues.
- Comparing on-chain yield against Treasury bill benchmarks.
- Assessing asset and protocol risk.
- Incorporating Nansen on-chain intelligence.
- Producing risk-adjusted allocation recommendations.
- Recording decisions on-chain.
- Settling later outcomes against realized performance.

The core idea:

> Agents should not only make financial recommendations. They should make recommendations that can be audited, benchmarked and scored over time.

NeuralRate MCP focuses on three pillars:

1. **Agent-native composability** — any MCP-compatible agent can call the tools.
2. **Nansen-enhanced intelligence** — wallet labels, smart money movement, holder behavior, flow anomalies and protocol/entity context enrich the raw on-chain data.
3. **Verifiable benchmarking** — every major recommendation is committed on-chain, then later settled against realized outcomes.

---

# 2. Why This Should Exist

Mantle's RWA ecosystem includes assets such as USDY, mUSD, USDe, mETH and related yield venues across Mantle-native DeFi protocols. These assets can generate yields that may compete with or exceed short-term Treasury benchmarks, but the decision is not as simple as choosing the highest APY.

A serious autonomous agent needs to evaluate:

- Current APY.
- Yield stability.
- TVL and liquidity depth.
- Depeg risk.
- Redemption or issuer risk.
- Protocol risk.
- Smart contract risk.
- Concentration risk.
- Smart money inflows and outflows.
- Whale movement.
- Sudden liquidity migration.
- Spread against risk-free or near-risk-free benchmarks.
- Historical realized performance versus recommendation.

Most dashboards show the first one or two signals. NeuralRate MCP turns the full decision context into an agent-callable primitive.

---

# 3. Core Thesis

Most hackathon submissions in this category will likely be framed as:

> “An AI agent that optimizes yield.”

NeuralRate MCP is framed as:

> “A verifiable RWA yield intelligence layer for autonomous agents on Mantle.”

This difference matters. The project is not competing only on APY selection. It competes on:

- Trustworthiness of the agent's reasoning.
- Quality of data inputs.
- Ability to evaluate decisions over time.
- Reusability by other agents.
- ERC-8004-native identity and reputation.
- Nansen-enhanced on-chain intelligence.
- Clear benchmark against Treasury yields and realized outcomes.

---

# 4. High-Level Architecture

```txt
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT CONSUMERS                              │
│                                                                     │
│  Telegram Agent     External AI Agent     ERC-8004 Agent             │
│  demo consumer      API-key consumer      identity-aware consumer    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ MCP over SSE / HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NEURALRATE MCP SERVER                    │
│                         Cloudflare Worker                           │
│                                                                     │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │ MCP Tool Layer │  │ Reasoning Layer   │  │ Identity Layer       │ │
│  │                │  │                  │  │                     │ │
│  │ yield_scan     │  │ Deterministic     │  │ ERC-8004 identity    │ │
│  │ tbill_spread   │  │ scoring first     │  │ DecisionCreated log  │ │
│  │ nansen_context │  │ LLM synthesis     │  │ DecisionSettled log  │ │
│  │ risk_assess    │  │ Explanation only  │  │ Agent reputation     │ │
│  │ optimal_alloc  │  │ No black-box risk │  │ Optional caller addr │ │
│  │ log_decision   │  │                  │  │                     │ │
│  │ get_decisions  │  │                  │  │                     │ │
│  └────────────────┘  └──────────────────┘  └─────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Cache + Snapshot Layer                                         │ │
│  │ Cloudflare KV / D1 / R2                                        │ │
│  │ - 5 min yield cache                                            │ │
│  │ - data snapshot hash                                           │ │
│  │ - decision metadata                                            │ │
│  │ - settlement schedule                                          │ │
│  │ - cached Nansen-enriched demo snapshots                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ Reads / writes
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                           │
│                                                                     │
│  Mantle RPC / Subgraphs       Nansen API             FRED API       │
│  - pool state                 - smart money flows    - DGS3MO       │
│  - TVL/liquidity              - wallet labels        - DGS1         │
│  - APY inputs                 - holder behavior                     │
│  - token prices               - entity context                      │
│                                                                     │
│  DefiLlama                    Agni Finance          Merchant Moe    │
│  - yield pools                - pool liquidity      - AMM context   │
│                                                                     │
│  Aave V3 / Fluxion            Pyth / Chainlink       Ondo / Ethena  │
│  - lending data               - depeg monitoring     - attestations │
│  - protocol rates             - token prices         - funding data │
│                                                                     │
│  Mantle Contracts             Decision Benchmark     ERC-8004       │
│  - events                     - benchmark events     - identity     │
└─────────────────────────────────────────────────────────────────────┘
```

---

# 5. Nansen Integration Strategy

Nansen is not treated as a decorative sponsor API. It is used as an intelligence layer that strengthens the parts of the product where raw RPC data is not enough.

## 5.1 Why Nansen improves the project

Raw on-chain data can show what happened. Nansen can help explain **who** is moving, **how meaningful** the movement is and whether the signal looks like ordinary activity or a higher-quality market signal.

NeuralRate MCP uses Nansen for:

| Signal | Why it matters for yield decisions |
|---|---|
| Smart money inflow/outflow | Detects whether sophisticated wallets are entering or exiting an asset or protocol. |
| Wallet/entity labels | Helps distinguish organic liquidity from exchange, fund, market maker or whale activity. |
| Holder concentration | Identifies whether liquidity or asset supply is controlled by a small number of wallets. |
| Token/protocol activity | Adds context around unusual activity, volume spikes or sudden rotation. |
| Wallet profiler data | Helps evaluate whether large flows are coming from credible/active wallets. |
| Nansen Agent / research layer | Can provide an optional natural-language intelligence summary for the playground. |

## 5.2 Nansen as premium signal, not single point of failure

The core product must still work if Nansen credits are temporarily unavailable.

Therefore:

- **Core mode:** Mantle RPC + protocol APIs/subgraphs + FRED.
- **Enhanced mode:** Core mode + Nansen context.
- **Demo mode:** Cached Nansen-enriched snapshots to ensure the hackathon demo remains reliable.

This avoids a common hackathon risk: a strong API integration that breaks during the live demo.

---

# 6. MCP Tools Specification

## 6.1 `yield_scan()`

Scans major Mantle RWA and stablecoin yield venues.

**Purpose:** Return current yield opportunities with liquidity and confidence metadata.

**Input:**

```json
{
  "assets": ["mUSD", "USDY", "USDe", "mETH"],
  "min_tvl_usd": 100000,
  "include_inactive": false
}
```

**Output:**

```json
{
  "timestamp": "2026-05-21T18:30:00Z",
  "source_mode": "core_plus_nansen",
  "pools": [
    {
      "protocol": "Agni Finance",
      "asset": "mUSD",
      "apy": 5.31,
      "apy_source": "protocol_api",
      "tvl_usd": 42000000,
      "liquidity_depth_usd": 800000,
      "last_updated": "2026-05-21T18:29:30Z",
      "data_confidence": "HIGH"
    },
    {
      "protocol": "Aave V3 Mantle",
      "asset": "USDY",
      "apy": 4.98,
      "apy_source": "subgraph",
      "tvl_usd": 61000000,
      "liquidity_depth_usd": 1200000,
      "last_updated": "2026-05-21T18:29:45Z",
      "data_confidence": "HIGH"
    }
  ]
}
```

---

## 6.2 `tbill_spread()`

Compares the best risk-adjusted on-chain yield against short-term Treasury benchmarks.

**Purpose:** Avoid the mistake of treating on-chain APY in isolation.

**Input:**

```json
{
  "benchmark": "DGS3MO",
  "asset_filter": ["mUSD", "USDY", "USDe"],
  "risk_adjusted": true
}
```

**Output:**

```json
{
  "timestamp": "2026-05-21T18:30:00Z",
  "benchmark": {
    "name": "3-Month Treasury Constant Maturity Rate",
    "symbol": "DGS3MO",
    "rate": 3.65,
    "source": "FRED"
  },
  "best_onchain": {
    "protocol": "Agni Finance",
    "asset": "mUSD",
    "raw_apy": 5.31,
    "risk_adjusted_apy": 4.82
  },
  "spread_bps": 117,
  "spread_direction": "onchain_premium",
  "interpretation": "On-chain yield currently offers a premium over the selected Treasury benchmark after applying risk adjustment."
}
```

---

## 6.3 `nansen_context(asset: string, protocol?: string)`

Fetches Nansen-enhanced intelligence for an asset/protocol pair.

**Purpose:** Add higher-quality on-chain intelligence beyond raw APY and TVL.

**Input:**

```json
{
  "asset": "USDY",
  "protocol": "Aave V3 Mantle",
  "timeframe": "24h"
}
```

**Output:**

```json
{
  "asset": "USDY",
  "protocol": "Aave V3 Mantle",
  "timeframe": "24h",
  "nansen_available": true,
  "signals": {
    "smart_money_netflow_usd": 840000,
    "smart_money_direction": "INFLOW",
    "large_wallet_netflow_usd": 1250000,
    "holder_concentration_change": "STABLE",
    "labeled_entity_activity": [
      {
        "label_type": "market_maker",
        "direction": "INFLOW",
        "amount_usd": 420000
      },
      {
        "label_type": "fund",
        "direction": "NO_SIGNIFICANT_CHANGE",
        "amount_usd": 0
      }
    ],
    "anomaly_score": 22,
    "confidence": "MEDIUM_HIGH"
  },
  "summary": "Nansen data shows positive smart money inflow and no unusual concentration spike during the selected timeframe."
}
```

If Nansen is unavailable:

```json
{
  "asset": "USDY",
  "protocol": "Aave V3 Mantle",
  "nansen_available": false,
  "fallback_used": true,
  "fallback_sources": ["Mantle RPC", "protocol_subgraph"],
  "summary": "Nansen context unavailable. Risk score computed using fallback on-chain and protocol-level data."
}
```

---

## 6.4 `risk_assess(protocol: string, asset: string)`

Returns a deterministic risk score for a protocol/asset combination.

**Important design choice:** the risk score is not invented by the LLM. The score is computed through deterministic factors. The LLM only explains the result.

**Input:**

```json
{
  "protocol": "Agni Finance",
  "asset": "mUSD",
  "include_nansen": true
}
```

**Scoring model:**

| Factor | Weight |
|---|---:|
| Depeg / price deviation history | 20% |
| Liquidity depth and exit capacity | 20% |
| TVL and concentration | 15% |
| Protocol / smart contract risk | 15% |
| Issuer / collateral mechanism risk | 15% |
| Nansen smart money and wallet-flow context | 15% |

**Output:**

```json
{
  "protocol": "Agni Finance",
  "asset": "mUSD",
  "risk_score": 34,
  "risk_level": "LOW",
  "score_method": "deterministic_weighted_v1",
  "factors": {
    "depeg_history": {
      "score": 8,
      "weight": 20,
      "detail": "0 material depeg events above threshold detected in recent observations."
    },
    "liquidity_depth": {
      "score": 9,
      "weight": 20,
      "detail": "Exit depth is sufficient for the requested allocation size."
    },
    "tvl_concentration": {
      "score": 6,
      "weight": 15,
      "detail": "TVL is healthy with no extreme concentration detected."
    },
    "smart_contract_risk": {
      "score": 7,
      "weight": 15,
      "detail": "Protocol is established, but smart contract risk remains non-zero."
    },
    "issuer_mechanism_risk": {
      "score": 8,
      "weight": 15,
      "detail": "Asset is tied to RWA/stablecoin collateral assumptions."
    },
    "nansen_context": {
      "score": 6,
      "weight": 15,
      "detail": "Nansen shows positive smart money inflow and no abnormal whale exit."
    }
  },
  "explanation": "The opportunity is classified as LOW risk because liquidity is sufficient, depeg signals are quiet, and Nansen context does not show meaningful adverse flow."
}
```

---

## 6.5 `optimal_allocation(amount_usd, risk_profile)`

Produces a risk-adjusted allocation recommendation.

**Purpose:** Combine yield, Treasury spread, deterministic risk scoring and Nansen-enhanced context into one recommendation.

**Input:**

```json
{
  "amount_usd": 10000,
  "risk_profile": "conservative",
  "assets": ["mUSD", "USDY", "USDe"],
  "settlement_horizon_hours": 24,
  "log_onchain": true
}
```

**Output:**

```json
{
  "decision_id": "0xdec_20260521_000142",
  "timestamp": "2026-05-21T18:30:00Z",
  "risk_profile": "conservative",
  "recommendation": [
    {
      "protocol": "Agni Finance",
      "asset": "mUSD",
      "pct": 55,
      "amount_usd": 5500,
      "expected_apy": 5.31,
      "risk_adjusted_apy": 4.82,
      "risk_score": 34
    },
    {
      "protocol": "Aave V3 Mantle",
      "asset": "USDY",
      "pct": 45,
      "amount_usd": 4500,
      "expected_apy": 4.98,
      "risk_adjusted_apy": 4.61,
      "risk_score": 38
    }
  ],
  "excluded": [
    {
      "asset": "USDe",
      "reason": "Excluded for conservative profile due to higher mechanism and depeg sensitivity."
    }
  ],
  "blended_raw_apy": 5.16,
  "blended_risk_adjusted_apy": 4.73,
  "tbill_spread_bps": 108,
  "nansen_summary": "Nansen context shows no significant smart money exit from selected assets and no abnormal holder concentration increase.",
  "reasoning": "For a conservative profile, the allocation favors RWA-backed stablecoin exposure with sufficient liquidity and positive or neutral Nansen flow context. USDe is excluded because its yield mechanism introduces risk not appropriate for this profile.",
  "data_snapshot_hash": "0x9c71...",
  "onchain": {
    "decision_created_tx": "0xabc123...",
    "settlement_due_at": "2026-05-22T18:30:00Z"
  }
}
```

---

## 6.6 `log_decision(...)`

Persists a recommendation and its benchmark metadata in D1 after the allocation step.

**Purpose:** Store an auditable local record that can be correlated with `DecisionCreated` and `DecisionSettled` events on-chain.

**Typical fields:** `decisionId`, `agentAddress`, `predictedApyBps`, `riskProfile`, `allocationJson`, `dataSnapshotHash`, `txHash`.

---

## 6.7 `get_decisions(limit)`

Retrieves the latest logged recommendations for the dashboard and agent consumers.

**Input:**

```json
{
  "limit": 25
}
```

**Output:**

```json
[
  {
    "decision_id": "0xdec_20260521_000142",
    "predicted_apy_bps": 516,
    "risk_profile": "medium",
    "is_settled": false,
    "tx_hash": "0xabc123..."
  }
]
```

---

# 7. On-Chain Benchmarking Layer

The improved design logs both the recommendation and its later settlement.

This creates the strongest hackathon story:

> Every agent recommendation becomes a measurable prediction.

## 7.1 Decision lifecycle

```txt
1. Agent requests allocation.
2. MCP server scans yield venues.
3. MCP server fetches Treasury benchmark.
4. MCP server fetches Nansen context.
5. MCP server computes deterministic risk scores.
6. LLM writes human-readable explanation.
7. Server commits DecisionCreated on Mantle.
8. After settlement horizon, server recomputes realized outcome.
9. Server commits DecisionSettled on Mantle.
10. Agent reputation/performance dashboard updates.
```

## 7.2 Solidity contract sketch

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NeuralRateDecisionBenchmark {
    struct DecisionMeta {
        address agent;
        address requestedBy;
        bytes32 dataSnapshotHash;
        uint256 predictedApyBps;
        uint256 predictedRiskAdjustedApyBps;
        uint256 benchmarkRateBps;
        uint256 createdAt;
        uint256 settlementDueAt;
        bool settled;
    }

    address public immutable agentIdentity;
    uint256 public nextDecisionId;

    mapping(uint256 => DecisionMeta) public decisions;

    event DecisionCreated(
        uint256 indexed decisionId,
        address indexed agent,
        address indexed requestedBy,
        bytes32 dataSnapshotHash,
        uint256 predictedApyBps,
        uint256 predictedRiskAdjustedApyBps,
        uint256 benchmarkRateBps,
        uint256 settlementDueAt,
        string recommendationURI
    );

    event DecisionSettled(
        uint256 indexed decisionId,
        address indexed agent,
        uint256 realizedApyBps,
        int256 predictionErrorBps,
        int256 outperformanceVsBenchmarkBps,
        uint256 settledAt,
        string settlementURI
    );

    modifier onlyAgent() {
        require(msg.sender == agentIdentity, "Only agent");
        _;
    }

    constructor(address _agentIdentity) {
        agentIdentity = _agentIdentity;
    }

    function createDecision(
        address requestedBy,
        bytes32 dataSnapshotHash,
        uint256 predictedApyBps,
        uint256 predictedRiskAdjustedApyBps,
        uint256 benchmarkRateBps,
        uint256 settlementDueAt,
        string calldata recommendationURI
    ) external onlyAgent returns (uint256 decisionId) {
        decisionId = nextDecisionId++;

        decisions[decisionId] = DecisionMeta({
            agent: agentIdentity,
            requestedBy: requestedBy,
            dataSnapshotHash: dataSnapshotHash,
            predictedApyBps: predictedApyBps,
            predictedRiskAdjustedApyBps: predictedRiskAdjustedApyBps,
            benchmarkRateBps: benchmarkRateBps,
            createdAt: block.timestamp,
            settlementDueAt: settlementDueAt,
            settled: false
        });

        emit DecisionCreated(
            decisionId,
            agentIdentity,
            requestedBy,
            dataSnapshotHash,
            predictedApyBps,
            predictedRiskAdjustedApyBps,
            benchmarkRateBps,
            settlementDueAt,
            recommendationURI
        );
    }

    function settleDecision(
        uint256 decisionId,
        uint256 realizedApyBps,
        int256 predictionErrorBps,
        int256 outperformanceVsBenchmarkBps,
        string calldata settlementURI
    ) external onlyAgent {
        DecisionMeta storage decision = decisions[decisionId];
        require(decision.agent != address(0), "Invalid decision");
        require(!decision.settled, "Already settled");

        decision.settled = true;

        emit DecisionSettled(
            decisionId,
            agentIdentity,
            realizedApyBps,
            predictionErrorBps,
            outperformanceVsBenchmarkBps,
            block.timestamp,
            settlementURI
        );
    }
}
```

## 7.3 Why this is stronger than a simple log

A simple log proves that the agent said something.  
A decision + settlement model proves whether the agent's recommendation was useful.

This is much more aligned with the hackathon's on-chain benchmarking narrative.

---

# 8. ERC-8004 Agent Identity

NeuralRate MCP uses ERC-8004 as the server's agent identity layer.

The server has its own agent identity and every decision is associated with that identity. Consumers may call the MCP server without having their own on-chain identity, but identity-aware callers can pass an address or ERC-8004 agent address to start building their own usage history.

## 8.1 Identity model

```txt
Tier 1 — API-key caller
- Caller uses X-API-Key.
- requestedBy = address(0).
- Decision is logged under NeuralRate MCP agent identity.

Tier 2 — Identity-aware caller
- Caller uses X-API-Key.
- Caller passes X-Agent-Address.
- Decision is logged under NeuralRate MCP agent identity.
- requestedBy = caller agent address.
- Caller begins accumulating visible usage history.
```

## 8.2 Why this matters

- The MCP server becomes a reusable agent with its own reputation.
- Recommendations are not anonymous black-box outputs.
- Other agents can evaluate whether this MCP server has historically produced useful decisions.
- The project becomes closer to agent infrastructure than a one-off app.

---

# 9. Reasoning Layer Design

The LLM should not be responsible for raw calculations or hidden risk scoring.

The system should be built as:

```txt
Deterministic data collection
        ↓
Deterministic risk scoring
        ↓
LLM synthesis and explanation
        ↓
On-chain decision commitment
        ↓
Outcome settlement
```

## 9.1 LLM responsibilities

The LLM can:

- Summarize risk factors.
- Explain allocation tradeoffs.
- Generate a readable decision memo.
- Compare conservative, moderate and aggressive options.
- Identify missing data or low-confidence signals.

The LLM should not:

- Invent APYs.
- Invent Nansen signals.
- Invent audit status.
- Create unsupported claims about issuer safety.
- Override deterministic risk limits without disclosure.

---

# 10. Prompt Architecture

## 10.1 Principle: Progressive Context Loading

The LLM never receives context for every asset at once. For each `risk_assess` or `optimal_allocation` call, the Worker dynamically injects only the assets relevant to the query.

```txt
final prompt = SYSTEM_BASE + asset_static[relevant] + asset_dynamic[relevant] + scoring_result + nansen_context
```

This keeps token usage low, improves factual control and reduces hallucination risk.

---

## 10.2 Static asset layer

This layer contains structural facts that rarely change: protocol mechanism, asset role, risk class, audit history and integration path.

Manual updates are acceptable here because the content is structural, not market-sensitive.

```python
ASSET_STATIC = {
    "USDT": {
        "role": "entry",
        "mechanism": "Bridged stablecoin. No native yield on Mantle.",
        "path": "Swap to mUSD via Agni Finance for yield deployment."
    },
    "USDC": {
        "role": "entry",
        "mechanism": "Bridged stablecoin. Deployable as collateral in Aave V3.",
        "path": "Deposit → borrow against LTV → deploy into mUSD. Risk: liquidation if spread widens."
    },
    "mUSD": {
        "role": "yield",
        "mechanism": "Rebasing wrapper of USDY. Backed by US Treasuries via Ondo Finance.",
        "risk_class": "RWA_TBILL",
        "audits": ["Quantstamp 2024", "Trail of Bits 2024"]
    },
    "USDY": {
        "role": "yield",
        "mechanism": "Ondo Finance tokenized T-bill note. Non-rebasing. Bearer instrument structure.",
        "risk_class": "RWA_TBILL",
        "audits": ["Ondo internal + external attestations"]
    },
    "USDe": {
        "role": "yield",
        "mechanism": "Ethena delta-neutral synthetic dollar. Short perp hedge on CEX.",
        "risk_class": "SYNTHETIC",
        "risk_note": "Yield spikes in bull markets, compresses or goes negative in bear markets. Depeg risk during funding rate reversals."
    },
    "mETH": {
        "role": "yield",
        "mechanism": "Mantle liquid staking / ETH yield asset.",
        "risk_class": "LST",
        "risk_note": "Subject to staking, liquidity, oracle and ETH market exposure."
    }
}
```

---

## 10.3 Dynamic asset layer

This layer contains market-sensitive data. No field in this layer should be manually maintained.

```python
ASSET_DYNAMIC = {
    "mUSD": {
        "apy_current": 5.31,
        "tvl_usd": 42_000_000,
        "liquidity_depth_usd": 800_000,

        "supply_usd": 870_000_000,
        "supply_trend_7d": "+4.2%",

        "backing_ratio": 1.0012,
        "last_attestation": "2026-05-01",

        "depeg_events_90d": [],
        "max_deviation_bps_90d": 3,

        "nansen": {
            "smart_money_direction": "INFLOW",
            "smart_money_netflow_usd": 840_000,
            "holder_concentration_change": "STABLE",
            "anomaly_score": 22
        }
    },
    "USDe": {
        "apy_current": 8.14,
        "tvl_usd": 61_000_000,
        "liquidity_depth_usd": 1_200_000,

        "supply_usd": 5_200_000_000,
        "supply_trend_7d": "+1.1%",

        "funding_rate_current": 0.0082,
        "funding_rate_7d_avg": 0.0071,

        "depeg_events_90d": [
            {"timestamp": "2026-03-12T14:00Z", "deviation_bps": 87, "duration_h": 2.3}
        ],
        "max_deviation_bps_90d": 87
    }
}
```

---

## 10.4 Dynamic data sources

| Field | Source | Stability | Cache TTL |
|---|---|---|---|
| `apy_current`, `tvl_usd` | DefiLlama `yields.llama.fi/pools`, protocol APIs, subgraphs | High | 5 min |
| `liquidity_depth_usd` | Mantle RPC, DEX pool reads, subgraphs | High | 5 min |
| `supply_usd`, `supply_trend` | ERC-20 `totalSupply()` on Mantle RPC | Maximum — on-chain | 15 min |
| `backing_ratio` | Ondo Finance attestations | High — periodic publication | 24h |
| `depeg_events_90d` | Pyth / Chainlink price feeds | High | 1h |
| `funding_rate` | Ethena API / Nansen | High | 15 min |
| `smart_money_netflow_usd` | Nansen | Premium signal | 15 min |
| `holder_concentration_change` | Nansen / fallback holder analysis | Medium-high | 15 min |
| `benchmark_rate` | FRED API `DGS3MO` / `DGS1` | Official macro data | 24h |

---

## 10.5 Automated depeg detection

The Worker cron monitors price feeds and records events without manual intervention.

```python
async def detect_depeg_events(asset: str, lookback_days: int = 90) -> list:
    feed_address = PRICE_FEEDS[asset]  # Pyth/Chainlink feed on Mantle
    prices = await fetch_historical_prices(feed_address, lookback_days)

    events = []
    for p in prices:
        deviation_bps = round(abs(p.price - 1.0) * 10_000, 1)
        if deviation_bps > 50:  # threshold: 50 bps
            events.append({
                "timestamp": p.timestamp,
                "deviation_bps": deviation_bps,
                "duration_h": p.duration_hours
            })

    return events
```

The `risk_assess` tool should not claim:

```txt
"No depeg events."
```

It should claim:

```txt
"0 events > 50 bps in the last 90 days, verified through feed 0x4f2a..."
```

This makes the risk explanation auditable.

---

## 10.6 Runtime prompt construction

```python
def build_prompt(
    relevant_assets: list[str],
    dynamic_data: dict,
    risk_scores: dict,
    nansen_context: dict | None
) -> str:
    asset_blocks = []

    for asset in relevant_assets:
        static = ASSET_STATIC.get(asset, {})
        dynamic = dynamic_data.get(asset, {})
        risk = risk_scores.get(asset, {})
        nansen = (nansen_context or {}).get(asset, {})

        asset_blocks.append(f"""
### {asset}

Mechanism:
{static.get("mechanism", "N/A")}

Risk class:
{static.get("risk_class", static.get("role", "N/A"))}

Current market data:
- APY: {dynamic.get("apy_current", "N/A")}%
- TVL: ${dynamic.get("tvl_usd", 0):,.0f}
- Liquidity depth: ${dynamic.get("liquidity_depth_usd", 0):,.0f}
- Depeg events 90d: {len(dynamic.get("depeg_events_90d", []))}
- Max deviation 90d: {dynamic.get("max_deviation_bps_90d", 0)} bps

Deterministic risk:
- Risk score: {risk.get("risk_score", "N/A")}
- Risk level: {risk.get("risk_level", "N/A")}

Nansen context:
- Smart money direction: {nansen.get("smart_money_direction", "N/A")}
- Holder concentration change: {nansen.get("holder_concentration_change", "N/A")}
- Anomaly score: {nansen.get("anomaly_score", "N/A")}
""")

    return SYSTEM_BASE + "\n\nAsset context:\n" + "\n".join(asset_blocks)
```

---

# 11. Data Snapshot Model

Each recommendation uses a data snapshot.

The snapshot contains:

```json
{
  "timestamp": "2026-05-21T18:30:00Z",
  "yield_scan": "...",
  "tbill_data": "...",
  "nansen_context": "...",
  "risk_scores": "...",
  "model": "gemini-2.5-flash-or-claude-sonnet",
  "prompt_version": "allocation_v1",
  "scoring_version": "risk_weighted_v1"
}
```

The server stores the full snapshot off-chain in KV/D1/R2 or object storage, then commits only:

- `dataSnapshotHash`
- predicted APY
- predicted risk-adjusted APY
- benchmark rate
- settlement horizon
- recommendation URI

This keeps gas low while preserving verifiability.

---

# 12. Data Flow

```txt
[Every 5 minutes]
  Mantle RPC / subgraphs → pool state, APY inputs, TVL, liquidity
  Protocol APIs          → yield venue metadata
  DefiLlama              → normalized APY / TVL reference data
  Nansen                 → smart money, wallet labels, flow context
  Cloudflare KV / D1     → cached normalized snapshots

[Every 15 minutes]
  ERC-20 totalSupply() on-chain → supply per asset
  Ethena API / Nansen           → USDe funding rate
  Nansen                        → holder concentration and flow data
  KV/D1                         → updated dynamic records

[Every 1 hour]
  Pyth / Chainlink price feeds  → depeg event detection
  KV/D1                         → depeg history and deviation summary

[Every 24 hours]
  FRED                          → Treasury benchmark rates
  Ondo Finance attestations     → USDY/mUSD backing ratio
  KV/D1                         → macro and backing context

[On yield_scan]
  KV hit → return cached result
  KV miss → fresh fetch → update KV → return

[On risk_assess(protocol, asset)]
  1. Load static context.
  2. Load dynamic market data.
  3. Load Nansen context or fallback.
  4. Compute deterministic risk score.
  5. LLM writes explanation only.
  6. Return score + explanation + source confidence.

[On optimal_allocation]
  1. yield_scan()
  2. tbill_spread()
  3. nansen_context() for candidate assets
  4. risk_assess() for candidate assets
  5. deterministic allocation constraints
  6. LLM explanation
  7. data snapshot hash
  8. DecisionCreated event on Mantle
  9. response to calling agent

[On settlement]
  1. Reload original decision snapshot.
  2. Fetch realized APY / liquidity / depeg data.
  3. Compute error and benchmark performance.
  4. Commit DecisionSettled event on Mantle.
  5. Update agent benchmark dashboard.

[On monitor trigger]
  1. Cron checks APY, liquidity, depeg and Nansen flow signals.
  2. If threshold crossed, webhook fires.
  3. Telegram demo consumer receives alert.
```

---

# 13. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| MCP Server | Cloudflare Workers | Zero-cost, SSE native, strong fit for lightweight agent infrastructure. |
| Cache | Cloudflare KV | Short TTL cache for yield, price and Nansen snapshots. |
| Structured storage | Cloudflare D1 | Decision metadata, settlement schedule and benchmark dashboard data. |
| Snapshot storage | Cloudflare R2 or KV/D1 | Full off-chain data snapshots linked by hash. |
| LLM reasoning | BYOK — Claude Sonnet / Gemini Flash | LLM explains deterministic outputs and allocation tradeoffs. |
| On-chain reads | Mantle RPC + ethers.js | Pool state, token supply, TVL and contract reads. |
| On-chain writes | Hardhat + ethers.js | Decision benchmark contract deployment and event writes. |
| Frontend | Next.js + Cloudflare Pages | Fast deployment, compatible with existing infra patterns. |
| Treasury data | FRED API `DGS3MO`, `DGS1` | Official benchmark for T-bill comparison. |
| On-chain analytics | Nansen API | Sponsor-aligned premium context for smart money and wallet flows. |
| Yield data | DefiLlama + protocol APIs/subgraphs | Normalized APY / TVL plus protocol-specific checks. |
| Price feeds | Pyth / Chainlink | Depeg monitoring and price deviation history. |
| Alerts | Telegram Bot API | Simple demo consumer for monitor events. |

---

# 14. Frontend / Demo Experience

The frontend should not look like a normal DeFi yield dashboard. It should look like an **agent benchmark terminal**.

## 14.1 Landing page

```txt
NEURALRATE MCP
Verifiable RWA yield intelligence for autonomous agents on Mantle.

[Open Agent Playground] [Read MCP Docs] [View On-Chain Benchmark]

Live Agent Stats
- MCP tools: 7
- Data sources: Mantle RPC, Nansen, FRED, protocol subgraphs
- Decisions created: 142
- Decisions settled: 87
- Avg prediction error: 14 bps
- Avg outperformance vs T-bill: +126 bps
- ERC-8004 Agent: 0x4f2a...

MCP Endpoint
https://neuralrate-worker.<ACCOUNT>.workers.dev/mcp
```

## 14.2 Playground

```txt
┌──────────────────────────────┬─────────────────────────────────────┐
│ Chat with Yield Agent         │ Tool Execution Stream                │
│                              │                                     │
│ > I have 10k USDC.            │ ✅ yield_scan()                      │
│   Conservative profile.       │    8 pools scanned                   │
│                              │                                     │
│                              │ ✅ tbill_spread()                    │
│ ← Recommendation              │    DGS3MO benchmark loaded           │
│   55% mUSD / Agni             │                                     │
│   45% USDY / Aave Mantle      │ ✅ nansen_context(USDY)              │
│                              │    Smart money: net inflow           │
│   Blended APY: 5.16%          │                                     │
│   Risk-adjusted: 4.73%        │ ✅ risk_assess(mUSD)                 │
│   Spread vs T-bill: +108 bps  │    Score: 34 / LOW                   │
│                              │                                     │
│                              │ ✅ optimal_allocation()               │
│                              │    DecisionCreated tx: 0xabc...      │
│                              │                                     │
│                              │ ⏳ settlement due in 24h              │
└──────────────────────────────┴─────────────────────────────────────┘
```

## 14.3 Benchmark dashboard

```txt
Agent Performance

Total decisions: 142
Settled decisions: 87
Average predicted APY: 5.16%
Average realized APY: 5.04%
Average prediction error: 12 bps
Average spread vs DGS3MO: +139 bps
Risk alerts triggered: 7
Nansen adverse-flow alerts: 2

Recent Decisions
| ID | Profile | Allocation | Predicted | Realized | Error | Status |
|---|---|---|---:|---:|---:|---|
| 142 | Conservative | mUSD/USDY | 5.16% | pending | - | Open |
| 141 | Moderate | mUSD/USDe/USDY | 5.42% | 5.36% | 6 bps | Settled |
| 140 | Conservative | USDY/mUSD | 5.02% | 4.94% | 8 bps | Settled |
```

This dashboard is central to the pitch. It proves the project understands agent performance as a measurable system.

---

# 15. Differentiators vs Saturated Competitors

| Dimension | Typical AI Yield App | NeuralRate MCP |
|---|---|---|
| Main interface | Human dashboard | MCP primitive for agents |
| Main output | Highest APY recommendation | Risk-adjusted, benchmarked decision |
| Data quality | APY + TVL | APY + TVL + T-bill + Nansen context |
| Risk scoring | Often vague or LLM-only | Deterministic scoring with LLM explanation |
| On-chain proof | Optional user transaction | DecisionCreated + DecisionSettled |
| Benchmarking | Usually absent | Realized outcome vs prediction and T-bill |
| ERC-8004 usage | Identity badge | Agent reputation tied to performance |
| Composability | Mostly frontend | Any MCP-compatible agent can consume it |
| Demo strength | Chatbot recommendation | Agent benchmark terminal + tool stream + txs |
| Prompt design | Large generic context | Progressive context loading per relevant asset |
| Depeg analysis | Manual or absent | Automated feed-based depeg event detection |

---

# 16. Target Hackathon Prizes

## 16.1 Primary: AI x RWA

This is the strongest track fit.

The project directly addresses:

- Dynamic yield strategies.
- Automated risk management.
- USDY / mUSD / USDe style RWA and yield-bearing assets.
- Mantle-native DeFi infrastructure.
- On-chain benchmarking of agent recommendations.

## 16.2 Secondary: Agentic Wallets & Economy

The project can also qualify as an agentic wallet/economy primitive if the demo includes:

- An external agent consuming the MCP endpoint.
- Optional caller identity.
- A simulated or signed allocation action.
- Usage history for other agents.

## 16.3 Stretch: Best UI/UX

Possible only if the benchmark dashboard and tool execution stream feel polished.

---

# 17. Implementation Plan

## Week 1 — Core MCP and data normalization

**Deliverables:**

- Cloudflare Worker scaffold.
- MCP over SSE endpoint.
- `yield_scan()`.
- `tbill_spread()`.
- KV/D1 cache.
- Basic protocol adapters.
- FRED integration.
- DefiLlama integration.
- Normalized data schema.

**Goal:** working MCP server with real data.

---

## Week 2 — Nansen, prompt architecture and risk engine

**Deliverables:**

- Nansen API adapter.
- `nansen_context()`.
- Static asset context layer.
- Dynamic asset context layer.
- Automated depeg detection scaffold.
- Deterministic `risk_assess()`.
- Risk scoring version `risk_weighted_v1`.
- Fallback behavior if Nansen is unavailable.
- Cached Nansen-enriched snapshots for demo safety.

**Goal:** make the project sponsor-aligned and stronger than raw APY dashboards.

---

## Week 3 — Allocation, on-chain benchmark and ERC-8004

**Deliverables:**

- `optimal_allocation()`.
- LLM synthesis layer.
- Data snapshot hash model.
- `NeuralRateDecisionBenchmark` contract.
- `DecisionCreated` event.
- `DecisionSettled` event.
- ERC-8004 agent identity.
- First benchmark dashboard data.

**Goal:** transform the project from “recommendation app” to verifiable agent infrastructure.

---

## Week 4 — Demo, UX, docs and submission

**Deliverables:**

- Landing page.
- Agent Playground.
- Tool execution stream.
- Benchmark dashboard.
- Telegram alert demo.
- README.
- Pitch deck / demo video.
- X thread.
- DoraHacks submission.

**Goal:** make the story obvious in under 90 seconds.

---

# 18. Minimal Viable Demo

The submission can be strong with the following minimum:

1. MCP endpoint live.
2. `yield_scan`, `tbill_spread`, `nansen_context`, `risk_assess`, `optimal_allocation` working.
3. One ERC-8004 agent identity.
4. `DecisionCreated` contract deployed on Mantle.
5. At least one `DecisionSettled` example.
6. Playground showing tool calls.
7. Benchmark dashboard showing predicted vs realized outcome.
8. Dashboard/agent consumers retrieving recent history via `get_decisions`.

---

# 19. Key Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Too similar to generic AI yield optimizers | Emphasize MCP infrastructure, decision settlement, Nansen intelligence and ERC-8004 reputation. |
| Nansen API unavailable during demo | Use cached enriched snapshots and fallback RPC/subgraph mode. |
| LLM hallucination | Use deterministic data and scoring; LLM only explains. |
| On-chain logging too expensive | Store full snapshot off-chain; log hashes and compact metrics on-chain. |
| Data source inconsistency | Add source confidence field and timestamp every metric. |
| UI looks like another dashboard | Build benchmark terminal and tool execution stream, not only APY cards. |
| Settlement difficult in short hackathon | Start with 1h and 24h settlement horizons; show at least several settled demo decisions. |
| Prompt becomes too large | Use progressive context loading and only inject relevant assets. |
| Manual risk claims become unauditable | Use feed-based depeg history and source-linked scoring factors. |

---

# 20. Submission Narrative

## 20.1 Short pitch

> NeuralRate MCP is a verifiable RWA yield reasoning layer for autonomous agents on Mantle. It scans Mantle yield venues, compares returns against Treasury benchmarks, enriches risk analysis with Nansen on-chain intelligence, and produces risk-adjusted allocation recommendations through MCP. Every recommendation is committed on-chain under an ERC-8004 agent identity and later settled against realized outcomes, turning agent decisions into a measurable performance record.

## 20.2 Tagline

> Verifiable RWA yield intelligence for autonomous agents on Mantle.

## 20.3 Alternative tagline

> The MCP risk layer for Mantle RWA agents.

## 20.4 One-liner

> NeuralRate MCP helps autonomous agents reason about Mantle RWA yield opportunities using live market data, Nansen intelligence and verifiable on-chain performance history.

---

# 21. Final Positioning

NeuralRate MCP should not be described as a DeFi dashboard.

It should be described as:

> A reusable MCP intelligence layer that helps autonomous agents reason about Mantle RWA yield opportunities, with Nansen-enhanced on-chain context and verifiable on-chain performance history.

The strongest version of the project is not the one that finds the highest yield.  
The strongest version is the one that proves whether its yield decisions were good.

---

# 22. Open Questions

These should be resolved during Week 1.

| Question | Recommendation |
|---|---|
| LLM provider for reasoning | Use Gemini Flash or Claude Sonnet via BYOK; keep model adapter generic. |
| Nansen API scope | Prioritize smart money flows, wallet labels, holder concentration and protocol/entity context. |
| ERC-8004 minting | Research Mantle's official support/interface and allocate 1 implementation day. |
| FRED API rate limits | Cache benchmark rates for 24h to avoid unnecessary calls. |
| Settlement horizon | Use 1h for demo speed and 24h for more credible benchmark examples. |
| Snapshot storage | Use D1 for metadata and R2/KV for full snapshots depending on payload size. |
| UI identity | Use “agent benchmark terminal,” not “yield dashboard.” |

---

# 23. Recommended README Structure

For GitHub, use this order:

1. What is NeuralRate MCP?
2. Why it matters.
3. Architecture.
4. MCP tools.
5. Nansen integration.
6. Risk scoring model.
7. On-chain benchmarking.
8. ERC-8004 identity.
9. Demo flow.
10. Tech stack.
11. Local development.
12. Environment variables.
13. Deployment.
14. Hackathon submission links.
15. License.

---

# 24. Recommended Environment Variables

```bash
# Mantle
MANTLE_RPC_URL=
AGENT_PRIVATE_KEY=
DECISION_BENCHMARK_CONTRACT=
ERC8004_AGENT_ADDRESS=

# Cloudflare
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
KV_NAMESPACE_ID=
D1_DATABASE_ID=
R2_BUCKET=

# Data
FRED_API_KEY=
NANSEN_API_KEY=
DEFILLAMA_BASE_URL=https://yields.llama.fi
PYTH_ENDPOINT=
CHAINLINK_REGISTRY=

# LLM
LLM_PROVIDER=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

# Alerts
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

---

# 25. Recommended Repository Layout

```txt
neuralrate-mcp/
├── apps/
│   ├── worker/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── mcp/
│   │   │   │   ├── server.ts
│   │   │   │   └── tools/
│   │   │   │       ├── yield-scan.ts
│   │   │   │       ├── tbill-spread.ts
│   │   │   │       ├── nansen-context.ts
│   │   │   │       ├── risk-assess.ts
│   │   │   │       ├── optimal-allocation.ts
│   │   │   │       ├── settle-decision.ts
│   │   │   │       └── position-monitor.ts
│   │   │   ├── data/
│   │   │   │   ├── mantle.ts
│   │   │   │   ├── nansen.ts
│   │   │   │   ├── fred.ts
│   │   │   │   ├── defillama.ts
│   │   │   │   ├── pyth.ts
│   │   │   │   └── ondo.ts
│   │   │   ├── risk/
│   │   │   │   ├── scoring.ts
│   │   │   │   └── factors.ts
│   │   │   ├── prompt/
│   │   │   │   ├── static-assets.ts
│   │   │   │   ├── build-prompt.ts
│   │   │   │   └── versions.ts
│   │   │   ├── snapshots/
│   │   │   │   ├── create-snapshot.ts
│   │   │   │   └── hash-snapshot.ts
│   │   │   └── chain/
│   │   │       ├── decision-benchmark.ts
│   │   │       └── erc8004.ts
│   │   └── wrangler.toml
│   │
│   └── web/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── playground/page.tsx
│       │   └── benchmark/page.tsx
│       └── components/
│           ├── ToolExecutionStream.tsx
│           ├── AgentStats.tsx
│           └── BenchmarkTable.tsx
│
├── contracts/
│   ├── NeuralRateDecisionBenchmark.sol
│   └── scripts/
│       └── deploy.ts
│
├── docs/
│   ├── architecture.md
│   ├── mcp-tools.md
│   ├── risk-scoring.md
│   └── nansen-integration.md
│
├── README.md
└── LICENSE
```
