import { z } from "zod";
import { DefiLlamaService } from "../services/defillama";
import { FredService } from "../services/fred";
import { NansenService } from "../services/nansen";

export const yieldScanSchema = {
  minTvlUsd: z.number().optional().default(100000).describe("Minimum TVL in USD to filter by"),
  chainFilter: z.string().optional().default("Mantle").describe("Chain to filter pools for")
};

export const tbillSpreadSchema = {
  apy: z.number().describe("The APY of the DeFi pool to compare against the T-Bill rate")
};

export const nansenContextSchema = {
  tokenAddress: z.string().describe("The contract address of the token to check"),
  chain: z.string().optional().default("mantle").describe("The blockchain network")
};

export const riskAssessSchema = {
  protocolTvlUsd: z.number().describe("Total Value Locked in the protocol"),
  apy: z.number().describe("Current APY of the pool"),
  apyBase: z.number().optional().default(0).describe("Base APY (organic yield)"),
  apyReward: z.number().optional().default(0).describe("Reward APY (incentivized)"),
  volumeUsd1d: z.number().optional().default(0).describe("24h trading volume in USD"),
  volumeUsd7d: z.number().optional().default(0).describe("7d trading volume in USD"),
  apyMean30d: z.number().optional().default(0).describe("30-day mean APY"),
  apyPct1D: z.number().optional().default(0).describe("APY 1-day change %"),
  apyPct7D: z.number().optional().default(0).describe("APY 7-day change %"),
  ilRisk: z.string().optional().default("no").describe("Impermanent Loss risk flag"),
  stablecoin: z.boolean().optional().default(false).describe("Whether the pool is stablecoin-based"),
  sigma: z.number().optional().default(0).describe("APY standard deviation (volatility)"),
  nansenSmartMoneyNetFlow: z.number().optional().default(0).describe("Net flow from smart money in 24h")
};

export const optimalAllocationSchema = {
  amountUsd: z.number().describe("Total amount to allocate in USD"),
  riskProfile: z.enum(["low", "medium", "high"]).describe("The investor's risk tolerance"),
  horizonHours: z.number().optional().default(24).describe("Settlement horizon in hours")
};

export const logDecisionSchema = {
  decisionId: z.string(),
  agentAddress: z.string(),
  requestedBy: z.string().optional(),
  dataSnapshotHash: z.string().optional(),
  predictedApyBps: z.number(),
  riskAdjustedApyBps: z.number().optional(),
  benchmarkRateBps: z.number().optional(),
  riskProfile: z.string().optional(),
  allocationJson: z.string().optional(),
  settlementHorizonHours: z.number().optional()
};

export const getDecisionsSchema = {
  limit: z.number().optional().default(50)
};

export class McpToolHandlers {
  constructor(
    private defillama: DefiLlamaService,
    private fred: FredService,
    private nansen: NansenService,
    private db: D1Database
  ) {}

  async handleYieldScan(args: { minTvlUsd: number; chainFilter: string }) {
    const pools = await this.defillama.getPools(args.chainFilter, args.minTvlUsd);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ pools: pools.slice(0, 10) }, null, 2) }]
    };
  }

  async handleTbillSpread(args: { apy: number }) {
    const tbillRate = await this.fred.getLatestTBillRate();
    const spreadBps = Math.round((args.apy - tbillRate) * 100);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          poolApy: args.apy,
          tbillRate: tbillRate,
          spreadBps: spreadBps,
          direction: spreadBps >= 0 ? "premium" : "discount"
        }, null, 2)
      }]
    };
  }

  async handleNansenContext(args: { tokenAddress: string; chain: string }) {
    const result = await this.nansen.getSmartMoneyFlows(args.tokenAddress, args.chain);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
    };
  }

  async handleRiskAssess(args: {
    protocolTvlUsd: number;
    apy: number;
    apyBase: number;
    apyReward: number;
    volumeUsd1d: number | null;
    volumeUsd7d: number | null;
    apyMean30d: number;
    apyPct1D: number;
    apyPct7D: number;
    ilRisk: string;
    stablecoin: boolean;
    sigma: number;
    nansenSmartMoneyNetFlow: number;
  }) {
    // ═══════════════════════════════════════════════════════
    // FACTOR 1: TVL Depth & Liquidity (Max 20 pts)
    // Uses logarithmic scale: deeper liquidity = exponentially safer
    // ═══════════════════════════════════════════════════════
    const tvl = args.protocolTvlUsd;
    let tvlScore: number;
    if (tvl >= 100_000_000) tvlScore = 20;
    else if (tvl >= 10_000_000) tvlScore = 16 + ((tvl - 10_000_000) / 90_000_000) * 4;
    else if (tvl >= 1_000_000) tvlScore = 10 + ((tvl - 1_000_000) / 9_000_000) * 6;
    else if (tvl >= 100_000) tvlScore = 3 + ((tvl - 100_000) / 900_000) * 7;
    else tvlScore = (tvl / 100_000) * 3;
    tvlScore = Math.round(tvlScore * 10) / 10;

    // ═══════════════════════════════════════════════════════
    // FACTOR 2: Volume/TVL Utilization Ratio (Max 15 pts)
    // Healthy DEX pools have volume between 1%-50% of TVL
    // Lending pools typically have null volume, scored by TVL proxy
    // ═══════════════════════════════════════════════════════
    let volTvlScore: number;
    let avgDailyVol = 0;
    let utilizationRatio = 0;

    if (args.volumeUsd1d === null && args.volumeUsd7d === null) {
      // Lending Market Logic
      if (tvl >= 10_000_000) volTvlScore = 15; // Massive liquidity, extremely safe
      else if (tvl >= 1_000_000) volTvlScore = 12; // Solid liquidity
      else volTvlScore = 8; // Small lending pool
    } else {
      // DEX Market Logic
      const vol1d = args.volumeUsd1d || 0;
      const vol7d = args.volumeUsd7d || 0;
      avgDailyVol = vol7d > 0 ? vol7d / 7 : vol1d;
      utilizationRatio = tvl > 0 ? (avgDailyVol / tvl) * 100 : 0;
      
      if (utilizationRatio >= 1 && utilizationRatio <= 50) {
        // Sweet spot: healthy utilization
        volTvlScore = 15;
      } else if (utilizationRatio > 50 && utilizationRatio <= 100) {
        // High turnover — somewhat risky (possible wash trading)
        volTvlScore = 10 - ((utilizationRatio - 50) / 50) * 5;
      } else if (utilizationRatio > 100) {
        // Extremely high — suspicious
        volTvlScore = Math.max(0, 5 - (utilizationRatio - 100) / 100 * 5);
      } else {
        // Too low (<1%) — illiquid, hard to exit
        volTvlScore = utilizationRatio * 10;
      }
    }
    volTvlScore = Math.round(Math.max(0, volTvlScore) * 10) / 10;

    // ═══════════════════════════════════════════════════════
    // FACTOR 3: APY Sustainability & Volatility (Max 20 pts)
    // Compares current APY vs 30d mean + checks sigma
    // ═══════════════════════════════════════════════════════
    const currentApy = args.apy;
    const meanApy = args.apyMean30d || currentApy;
    const sigma = args.sigma || 0;
    
    // Sub-factor A: Absolute sustainability (max 10pts)
    let apySustainScore: number;
    if (currentApy <= 10) apySustainScore = 10;
    else if (currentApy <= 20) apySustainScore = 8;
    else if (currentApy <= 50) apySustainScore = 5 - ((currentApy - 20) / 30) * 3;
    else apySustainScore = Math.max(0, 2 - (currentApy - 50) / 50 * 2);

    // Sub-factor B: Volatility penalty (max 10pts)
    // If current APY deviates wildly from 30d mean, penalize
    const deviation = meanApy > 0 ? Math.abs(currentApy - meanApy) / meanApy : 0;
    let apyVolatilityScore = 10;
    if (deviation > 0.5) apyVolatilityScore = 3;
    else if (deviation > 0.3) apyVolatilityScore = 6;
    else if (deviation > 0.1) apyVolatilityScore = 8;
    
    // Extra sigma penalty
    if (sigma > 10) apyVolatilityScore = Math.max(0, apyVolatilityScore - 3);
    else if (sigma > 5) apyVolatilityScore = Math.max(0, apyVolatilityScore - 1);

    const apyTotalScore = Math.round((apySustainScore + apyVolatilityScore) * 10) / 10;

    // ═══════════════════════════════════════════════════════
    // FACTOR 4: Yield Composition — Organic vs Incentive (Max 15 pts)
    // Higher organic (apyBase) ratio = more sustainable
    // ═══════════════════════════════════════════════════════
    const apyBase = args.apyBase || 0;
    const apyReward = args.apyReward || 0;
    const totalApyParts = apyBase + apyReward;
    const organicRatio = totalApyParts > 0 ? apyBase / totalApyParts : 0.5;
    let compositionScore: number;
    if (organicRatio >= 0.8) compositionScore = 15;
    else if (organicRatio >= 0.5) compositionScore = 10 + ((organicRatio - 0.5) / 0.3) * 5;
    else if (organicRatio >= 0.2) compositionScore = 5 + ((organicRatio - 0.2) / 0.3) * 5;
    else compositionScore = organicRatio * 25;
    compositionScore = Math.round(compositionScore * 10) / 10;

    // ═══════════════════════════════════════════════════════
    // FACTOR 5: IL Risk & Asset Exposure (Max 15 pts)
    // Stablecoins = safe, no IL = safe, IL = risky
    // ═══════════════════════════════════════════════════════
    let exposureScore: number;
    if (args.stablecoin) {
      exposureScore = 15; // Stablecoin pools are safest
    } else if (args.ilRisk === "no") {
      exposureScore = 12; // Single-sided or no IL
    } else if (args.ilRisk === "yes") {
      exposureScore = 5;  // IL exposure
    } else {
      exposureScore = 8;  // Unknown, assume moderate
    }

    // ═══════════════════════════════════════════════════════
    // FACTOR 6: Institutional Flow Signal (Max 15 pts)
    // Smart money net flow from Nansen
    // ═══════════════════════════════════════════════════════
    const flow = args.nansenSmartMoneyNetFlow;
    let nansenScore: number;
    if (flow > 500_000) nansenScore = 15;
    else if (flow > 100_000) nansenScore = 12;
    else if (flow > 0) nansenScore = 10;
    else if (flow > -100_000) nansenScore = 7;
    else nansenScore = 3;

    // ═══════════════════════════════════════════════════════
    // TOTAL
    // ═══════════════════════════════════════════════════════
    const totalScore = Math.round(
      (tvlScore + volTvlScore + apyTotalScore + compositionScore + exposureScore + nansenScore) * 10
    ) / 10;

    let classification = "CRITICAL";
    if (totalScore >= 80) classification = "LOW";
    else if (totalScore >= 60) classification = "MEDIUM";
    else if (totalScore >= 40) classification = "HIGH";

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          totalScore,
          maxScore: 100,
          classification,
          factors: {
            tvlDepth: { score: tvlScore, max: 20, input: tvl },
            volumeUtilization: { score: volTvlScore, max: 15, ratio: Math.round(utilizationRatio * 100) / 100, avgDailyVol: Math.round(avgDailyVol) },
            apySustainability: { score: apyTotalScore, max: 20, sustainSub: Math.round(apySustainScore * 10) / 10, volatilitySub: Math.round(apyVolatilityScore * 10) / 10, deviation: Math.round(deviation * 1000) / 10, sigma: Math.round(sigma * 100) / 100 },
            yieldComposition: { score: compositionScore, max: 15, organicRatio: Math.round(organicRatio * 100), apyBase, apyReward },
            assetExposure: { score: exposureScore, max: 15, ilRisk: args.ilRisk, stablecoin: args.stablecoin },
            institutionalFlow: { score: nansenScore, max: 15, netFlow: flow }
          }
        }, null, 2)
      }]
    };
  }

  async handleOptimalAllocation(args: { amountUsd: number; riskProfile: string; horizonHours: number }) {
    // Real implementation of optimal allocation
    const pools = await this.defillama.getPools("Mantle", 100000);
    const topPools = pools.slice(0, 5); // take top 5
    const tbillRate = await this.fred.getLatestTBillRate();

    let allocations = [];
    let allocatedAmount = 0;
    let blendedApy = 0;

    // Distribute based on risk profile
    if (args.riskProfile === "low") {
      // 80% to safest pool, 20% to next
      allocations = [
        { asset: topPools[0].symbol, protocol: topPools[0].project, allocationPercentage: 80, expectedApy: topPools[0].apy },
        { asset: topPools[1]?.symbol || "USDC", protocol: topPools[1]?.project || "Aave", allocationPercentage: 20, expectedApy: topPools[1]?.apy || 0 }
      ];
    } else if (args.riskProfile === "high") {
      // Find highest APY pool
      const highest = [...topPools].sort((a, b) => b.apy - a.apy);
      allocations = [
        { asset: highest[0].symbol, protocol: highest[0].project, allocationPercentage: 70, expectedApy: highest[0].apy },
        { asset: highest[1]?.symbol || "USDC", protocol: highest[1]?.project || "Aave", allocationPercentage: 30, expectedApy: highest[1]?.apy || 0 }
      ];
    } else {
      // Medium
      allocations = [
        { asset: topPools[0].symbol, protocol: topPools[0].project, allocationPercentage: 50, expectedApy: topPools[0].apy },
        { asset: topPools[1]?.symbol || "USDC", protocol: topPools[1]?.project || "Aave", allocationPercentage: 50, expectedApy: topPools[1]?.apy || 0 }
      ];
    }

    blendedApy = allocations.reduce((acc, curr) => acc + (curr.expectedApy * (curr.allocationPercentage / 100)), 0);

    const result = {
      status: "optimal_allocation",
      amountAllocated: args.amountUsd,
      riskProfile: args.riskProfile,
      horizon: args.horizonHours,
      allocations,
      blendedPredictedApy: parseFloat(blendedApy.toFixed(2)),
      tbillSpreadBps: Math.round((blendedApy - tbillRate) * 100)
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }]
    };
  }

  async handleLogDecision(args: any) {
    if (!this.db) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) }] };
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO decisions (
          decision_id, agent_address, requested_by, data_snapshot_hash,
          predicted_apy_bps, risk_adjusted_apy_bps, benchmark_rate_bps,
          risk_profile, allocation_json, settlement_horizon_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        args.decisionId,
        args.agentAddress,
        args.requestedBy || "0x0",
        args.dataSnapshotHash || "",
        args.predictedApyBps,
        args.riskAdjustedApyBps || 0,
        args.benchmarkRateBps || 0,
        args.riskProfile || "medium",
        args.allocationJson || "[]",
        args.settlementHorizonHours || 24
      ).run();

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: true, decisionId: args.decisionId }) }]
      };
    } catch (e: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: e.message }) }]
      };
    }
  }

  async handleGetDecisions(args: { limit: number }) {
    if (!this.db) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) }] };
    }

    try {
      const { results } = await this.db.prepare("SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?").bind(args.limit).all();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }]
      };
    } catch (e: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }]
      };
    }
  }
}
