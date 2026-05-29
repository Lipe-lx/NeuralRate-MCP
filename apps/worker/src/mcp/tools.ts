import { z } from "zod";
import { DefiLlamaService } from "../services/defillama";
import { FredService } from "../services/fred";
import { NansenService } from "../services/nansen";

const asJson = <T>(value: unknown, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

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
  ownerEoa: z.string().optional().describe("User owner EOA for personalized policy resolution"),
  userId: z.string().optional().describe("Optional internal user identifier"),
  amountUsd: z.number().describe("Total amount to allocate in USD"),
  objective: z.enum(["preserve", "income", "growth"]).optional().default("income").describe("Primary portfolio objective"),
  riskProfile: z.enum(["low", "medium", "high"]).describe("The investor's risk tolerance"),
  horizonHours: z.number().optional().default(24).describe("Settlement horizon in hours"),
  allowedAssets: z.array(z.string()).optional().default([]).describe("Optional asset allowlist"),
  deniedAssets: z.array(z.string()).optional().default([]).describe("Optional asset denylist"),
  allowedProtocols: z.array(z.string()).optional().default([]).describe("Optional protocol allowlist"),
  deniedProtocols: z.array(z.string()).optional().default([]).describe("Optional protocol denylist"),
  maxProtocolWeightBps: z.number().optional().default(5000).describe("Maximum protocol concentration in bps"),
  maxAssetWeightBps: z.number().optional().default(5000).describe("Maximum asset concentration in bps"),
  maxActionUsd: z.number().optional().default(1000).describe("Maximum autonomous action size in USD"),
  stableOnly: z.boolean().optional().default(false).describe("Restrict recommendations to stablecoin pools"),
  minSpreadOverTbillBps: z.number().optional().default(0).describe("Minimum required spread over 3M T-Bill in bps"),
  automationMode: z.enum(["recommend-only", "auto-within-limits"]).optional().default("recommend-only").describe("Whether the result is advisory-only or eligible for automation"),
  restrictionPreset: z.enum(["stable-only", "blue-chip-defi", "yield-maximizer", "rwa-focused"]).optional().default("blue-chip-defi").describe("Preset restrictions applied to the recommendation engine")
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
  settlementHorizonHours: z.number().optional(),
  benchmarkStatus: z.enum(["local", "pending", "onchain"]).optional(),
  txHash: z.string().optional(),
  onchainDecisionId: z.string().optional(),
  userId: z.string().optional(),
  vaultId: z.string().optional(),
  policyVersion: z.string().optional(),
  objective: z.string().optional(),
  automationMode: z.string().optional(),
  appliedConstraintsJson: z.string().optional(),
  rationaleJson: z.string().optional()
};

export const getDecisionsSchema = {
  limit: z.number().optional().default(50),
  ownerEoa: z.string().optional()
};

export const getUserStateSchema = {
  sessionToken: z.string().describe("Active MCP mutation session token"),
};

export const bootstrapUserVaultSchema = {
  ownerEoa: z.string().describe("Owner EOA for the dedicated vault"),
  externalWallet: z.string().optional(),
  embeddedWallet: z.string().optional(),
  authStrategy: z.string().optional(),
  displayName: z.string().optional(),
  privyUserId: z.string().optional(),
  providerUserRef: z.string().optional(),
  walletProvider: z.string().optional(),
  vaultAddress: z.string().optional(),
  vaultProvider: z.string().optional(),
  vaultKind: z.string().optional(),
  vaultStatus: z.string().optional(),
  safeDeploymentStatus: z.string().optional(),
  safeSaltNonce: z.string().optional(),
  chainId: z.number().optional(),
  auth: z.object({
    ownerEoa: z.string(),
    nonce: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
    signature: z.string(),
  }).describe("Signed mutation envelope from the owner wallet"),
};

export const updateAgentPolicySchema = {
  sessionToken: z.string().optional(),
  ownerEoa: z.string().optional(),
  auth: z.object({
    ownerEoa: z.string(),
    nonce: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
    signature: z.string(),
  }).optional(),
  objective: z.enum(["preserve", "income", "growth"]).optional(),
  riskProfile: z.enum(["low", "medium", "high"]).optional(),
  horizonHours: z.number().optional(),
  automationMode: z.enum(["recommend-only", "auto-within-limits"]).optional(),
  restrictionPreset: z.enum(["stable-only", "blue-chip-defi", "yield-maximizer", "rwa-focused"]).optional(),
  allowedAssets: z.array(z.string()).optional(),
  deniedAssets: z.array(z.string()).optional(),
  allowedProtocols: z.array(z.string()).optional(),
  deniedProtocols: z.array(z.string()).optional(),
  maxProtocolWeightBps: z.number().optional(),
  maxAssetWeightBps: z.number().optional(),
  maxActionUsd: z.number().optional(),
  maxDailyUsd: z.number().optional(),
  maxAutomationUsd: z.number().optional(),
  maxSlippageBps: z.number().optional(),
  rebalanceCadenceHours: z.number().optional(),
  minApyBps: z.number().optional(),
  minSpreadOverTbillBps: z.number().optional(),
  requireManualAboveUsd: z.number().optional(),
  pauseOnRiskEvent: z.boolean().optional(),
  policyVersion: z.string().optional(),
};

export const issueAutomationGrantSchema = {
  ownerEoa: z.string(),
  agentSubject: z.string().describe("Stable subject for the agent session, e.g. erc8004:49"),
  allowedDomains: z.array(z.enum(["state", "config", "benchmark", "execution"])).optional(),
  policyVersion: z.string().optional(),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  nonce: z.string().optional(),
  signature: z.string().optional().describe("Owner signature over the canonical grant message"),
  issuedVia: z.string().optional(),
};

export const revokeAutomationGrantSchema = {
  grantId: z.string().optional(),
  sessionToken: z.string().optional(),
  ownerEoa: z.string().optional(),
  auth: z.object({
    ownerEoa: z.string(),
    nonce: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
    signature: z.string(),
  }).optional(),
};

export const queueBenchmarkSchema = {
  sessionToken: z.string().optional(),
  ownerEoa: z.string().optional(),
  auth: z.object({
    ownerEoa: z.string(),
    nonce: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
    signature: z.string(),
  }).optional(),
  decisionId: z.string(),
  dataSnapshotHash: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
};

export const executeStrategySchema = {
  sessionToken: z.string().optional(),
  ownerEoa: z.string().optional(),
  auth: z.object({
    ownerEoa: z.string(),
    nonce: z.string(),
    issuedAt: z.string(),
    expiresAt: z.string(),
    signature: z.string(),
  }).optional(),
  strategyKey: z.string(),
  intent: z.object({
    targetAsset: z.string(),
    amountUsd: z.number(),
    amountToken: z.number().optional(),
    slippageBps: z.number().optional(),
    notes: z.string().optional(),
    snapshotHash: z.string().optional(),
    snapshotCid: z.string().optional(),
    deadline: z.string().optional(),
  }),
  payload: z.record(z.string(), z.unknown()).optional(),
};

export const listJobsSchema = {
  sessionToken: z.string(),
};

const PRESET_RULES = {
  "stable-only": {
    stableOnly: true,
    allowedProtocols: [] as string[],
    deniedProtocols: [] as string[],
  },
  "blue-chip-defi": {
    stableOnly: false,
    allowedProtocols: ["aave", "lendle", "agni", "merchant moe", "init"],
    deniedProtocols: [] as string[],
  },
  "yield-maximizer": {
    stableOnly: false,
    allowedProtocols: [] as string[],
    deniedProtocols: [] as string[],
  },
  "rwa-focused": {
    stableOnly: true,
    allowedProtocols: [],
    deniedProtocols: ["memeswap", "unknown"],
  },
} as const;

const normalizeList = (values?: string[]) =>
  (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);

const uniqueList = (values: string[]) => [...new Set(values)];

const protocolMatches = (protocol: string, allowlist: string[]) =>
  allowlist.length === 0 || allowlist.some((entry) => protocol.includes(entry));

const assetMatches = (asset: string, allowlist: string[]) =>
  allowlist.length === 0 || allowlist.includes(asset);

const isRwaLikeSymbol = (symbol: string) => ["usdy", "musd", "usde"].includes(symbol);

const rebalanceWeights = (weights: number[], capBps: number) => {
  if (!weights.length) {
    return weights;
  }

  const capPct = Math.max(1, capBps / 100);
  const capped = [...weights];
  let overflow = 0;

  for (let index = 0; index < capped.length; index += 1) {
    if (capped[index] > capPct) {
      overflow += capped[index] - capPct;
      capped[index] = capPct;
    }
  }

  if (overflow <= 0) {
    return capped;
  }

  const distributable = capped.reduce((count, value) => count + (value < capPct ? 1 : 0), 0);
  if (distributable === 0) {
    const even = 100 / capped.length;
    return capped.map(() => even);
  }

  const bonus = overflow / distributable;
  return capped.map((value) => (value < capPct ? value + bonus : value));
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

  async handleOptimalAllocation(args: {
    amountUsd: number;
    riskProfile: string;
    horizonHours: number;
    ownerEoa?: string;
    objective?: string;
    allowedAssets?: string[];
    deniedAssets?: string[];
    allowedProtocols?: string[];
    deniedProtocols?: string[];
    maxProtocolWeightBps?: number;
    maxAssetWeightBps?: number;
    maxActionUsd?: number;
    stableOnly?: boolean;
    minSpreadOverTbillBps?: number;
    automationMode?: string;
    restrictionPreset?: string;
  }) {
    const ownerEoa = (args as any).ownerEoa ? String((args as any).ownerEoa).toLowerCase() : null;
    let resolvedConfig: Record<string, unknown> | null = null;

    if (ownerEoa && this.db) {
      const record = await this.db
        .prepare("SELECT * FROM user_agent_configs WHERE owner_eoa = ? LIMIT 1")
        .bind(ownerEoa)
        .first<Record<string, unknown>>();

      if (record) {
        resolvedConfig = {
          ...record,
          allowed_assets: asJson(record.allowed_assets_json, [] as string[]),
          denied_assets: asJson(record.denied_assets_json, [] as string[]),
          allowed_protocols: asJson(record.allowed_protocols_json, [] as string[]),
          denied_protocols: asJson(record.denied_protocols_json, [] as string[]),
        };
      }
    }

    const presetName = String((args as any).restrictionPreset ?? resolvedConfig?.restriction_preset ?? "blue-chip-defi") as keyof typeof PRESET_RULES;
    const preset = PRESET_RULES[presetName] ?? PRESET_RULES["blue-chip-defi"];
    const objective = String((args as any).objective ?? resolvedConfig?.objective ?? "income");
    const automationMode = String((args as any).automationMode ?? resolvedConfig?.automation_mode ?? "recommend-only");
    const stableOnly = Boolean((args as any).stableOnly ?? preset.stableOnly);
    const allowedAssets = uniqueList([
      ...normalizeList((resolvedConfig?.allowed_assets as string[] | undefined) ?? []),
      ...normalizeList((args as any).allowedAssets ?? []),
    ]);
    const deniedAssets = uniqueList([
      ...normalizeList((resolvedConfig?.denied_assets as string[] | undefined) ?? []),
      ...normalizeList((args as any).deniedAssets ?? []),
    ]);
    const allowedProtocols = uniqueList([
      ...normalizeList(preset.allowedProtocols as string[]),
      ...normalizeList((resolvedConfig?.allowed_protocols as string[] | undefined) ?? []),
      ...normalizeList((args as any).allowedProtocols ?? []),
    ]);
    const deniedProtocols = uniqueList([
      ...normalizeList(preset.deniedProtocols as string[]),
      ...normalizeList((resolvedConfig?.denied_protocols as string[] | undefined) ?? []),
      ...normalizeList((args as any).deniedProtocols ?? []),
    ]);
    const maxProtocolWeightBps = Number((args as any).maxProtocolWeightBps ?? resolvedConfig?.max_protocol_weight_bps ?? 5000);
    const maxAssetWeightBps = Number((args as any).maxAssetWeightBps ?? resolvedConfig?.max_asset_weight_bps ?? 5000);
    const minSpreadOverTbillBps = Number((args as any).minSpreadOverTbillBps ?? resolvedConfig?.min_spread_over_tbill_bps ?? 0);
    const maxActionUsd = Number((args as any).maxActionUsd ?? resolvedConfig?.max_action_usd ?? 1000);
    const horizonHours = Number((args as any).horizonHours ?? resolvedConfig?.horizon_hours ?? 24);
    const riskProfile = String((args as any).riskProfile ?? resolvedConfig?.risk_profile ?? "medium");

    const pools = await this.defillama.getPools("Mantle", 100000);
    const tbillRate = await this.fred.getLatestTBillRate();
    const eligiblePools = pools
      .map((pool) => ({
        ...pool,
        normalizedAsset: String(pool.symbol || "").toLowerCase(),
        normalizedProtocol: String(pool.project || "").toLowerCase(),
        spreadBps: Math.round((pool.apy - tbillRate) * 100),
      }))
      .filter((pool) => !stableOnly || pool.stablecoin)
      .filter((pool) => assetMatches(pool.normalizedAsset, allowedAssets))
      .filter((pool) => protocolMatches(pool.normalizedProtocol, allowedProtocols))
      .filter((pool) => !deniedAssets.includes(pool.normalizedAsset))
      .filter((pool) => !deniedProtocols.some((entry) => pool.normalizedProtocol.includes(entry)))
      .filter((pool) => pool.spreadBps >= minSpreadOverTbillBps)
      .filter((pool) => {
        if (presetName !== "rwa-focused") {
          return true;
        }
        return isRwaLikeSymbol(pool.normalizedAsset) || pool.stablecoin;
      });

    const poolScore = (pool: (typeof eligiblePools)[number]) => {
      const tvlScore = Math.log10(Math.max(pool.tvlUsd, 100_000));
      const stabilityBonus = pool.stablecoin ? 12 : 0;
      const volatilityPenalty = Math.abs(pool.sigma ?? 0) * (riskProfile === "low" ? 1.2 : riskProfile === "medium" ? 0.75 : 0.45);
      const rewardScore =
        objective === "preserve"
          ? pool.spreadBps * 0.2 + tvlScore * 3 + stabilityBonus
          : objective === "growth"
            ? pool.apy * 6 + pool.spreadBps * 0.45 + (pool.apyReward ?? 0) * 1.5
            : pool.apy * 4 + pool.spreadBps * 0.35 + tvlScore * 2 + stabilityBonus * 0.4;
      return rewardScore - volatilityPenalty;
    };

    const rankedPools = [...eligiblePools].sort((a, b) => poolScore(b) - poolScore(a));
    const selectionCount = riskProfile === "low" ? 2 : riskProfile === "high" ? 4 : 3;
    const selectedPools = rankedPools.slice(0, selectionCount);

    const fallbackPools = selectedPools.length > 0 ? selectedPools : pools.slice(0, 3).map((pool) => ({
      ...pool,
      normalizedAsset: String(pool.symbol || "").toLowerCase(),
      normalizedProtocol: String(pool.project || "").toLowerCase(),
      spreadBps: Math.round((pool.apy - tbillRate) * 100),
    }));

    const baseWeights =
      riskProfile === "low"
        ? [60, 40]
        : riskProfile === "high"
          ? [40, 30, 20, 10]
          : [45, 30, 25];

    const cappedWeights = rebalanceWeights(
      baseWeights.slice(0, fallbackPools.length),
      Math.min(maxProtocolWeightBps, maxAssetWeightBps)
    );

    const allocations = fallbackPools.map((pool, index) => ({
      asset: pool.symbol,
      protocol: pool.project,
      allocationPercentage: Number((cappedWeights[index] ?? 0).toFixed(2)),
      allocationUsd: Number(((args.amountUsd * (cappedWeights[index] ?? 0)) / 100).toFixed(2)),
      expectedApy: pool.apy,
      expectedSpreadBps: pool.spreadBps,
      stablecoin: pool.stablecoin,
      rankingScore: Number(poolScore(pool).toFixed(2)),
    }));

    const blendedApy = allocations.reduce(
      (acc, curr) => acc + curr.expectedApy * (curr.allocationPercentage / 100),
      0
    );
    const maxRecommendedActionUsd = Math.min(maxActionUsd, args.amountUsd);
    const eligibleForAutomation =
      automationMode === "auto-within-limits" &&
      allocations.every((item) => item.allocationUsd <= maxRecommendedActionUsd + 0.0001);

    const result = {
      status: "optimal_allocation",
      amountAllocated: args.amountUsd,
      ownerEoa,
      objective,
      riskProfile,
      horizon: horizonHours,
      automationMode,
      restrictionPreset: presetName,
      allocations,
      blendedPredictedApy: parseFloat(blendedApy.toFixed(2)),
      tbillSpreadBps: Math.round((blendedApy - tbillRate) * 100),
      appliedConstraints: {
        stableOnly,
        allowedAssets,
        deniedAssets,
        allowedProtocols,
        deniedProtocols,
        maxProtocolWeightBps,
        maxAssetWeightBps,
        maxActionUsd,
        minSpreadOverTbillBps,
        policyVersion: String(resolvedConfig?.policy_version ?? "vault-v1"),
      },
      rationale: {
        datasetScope: "global market data, user-scoped decision policy",
        poolCountConsidered: pools.length,
        eligiblePoolCount: eligiblePools.length,
        rankingMode:
          objective === "preserve"
            ? "safety-first spread ranking"
            : objective === "growth"
              ? "yield-forward ranking"
              : "balanced income ranking",
      },
      automationEligibility: {
        mode: automationMode,
        eligible: eligibleForAutomation,
        maxActionUsd,
        reason: eligibleForAutomation
          ? "All suggested actions fit within the configured per-action limit."
          : "At least one allocation slice exceeds the configured autonomous action limit.",
      }
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
          risk_profile, allocation_json, settlement_horizon_hours,
          benchmark_status, tx_hash, onchain_decision_id,
          user_id, vault_id, policy_version, objective, automation_mode, applied_constraints_json, rationale_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        args.settlementHorizonHours || 24,
        args.benchmarkStatus || "local",
        args.txHash || null,
        args.onchainDecisionId || null,
        args.userId || null,
        args.vaultId || null,
        args.policyVersion || null,
        args.objective || "income",
        args.automationMode || "recommend-only",
        args.appliedConstraintsJson || null,
        args.rationaleJson || null
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

  async handleGetDecisions(args: { limit: number; ownerEoa?: string }) {
    if (!this.db) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) }] };
    }

    try {
      const normalizedOwner = args.ownerEoa?.toLowerCase();
      const query = normalizedOwner
        ? "SELECT * FROM decisions WHERE requested_by = ? OR agent_address = ? ORDER BY created_at DESC, id DESC LIMIT ?"
        : "SELECT * FROM decisions ORDER BY created_at DESC, id DESC LIMIT ?";
      const bindings = normalizedOwner ? [normalizedOwner, normalizedOwner, args.limit] : [args.limit];
      const { results } = await this.db.prepare(query).bind(...bindings).all();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }]
      };
    } catch (e: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }) }]
      };
    }
  }

  async handleUpdateDecisionBenchmark(args: {
    decisionId: string;
    benchmarkStatus?: string | null;
    txHash?: string | null;
    onchainDecisionId?: string | null;
    requestedBy?: string | null;
    dataSnapshotHash?: string | null;
    agentAddress?: string | null;
    userId?: string | null;
    vaultId?: string | null;
    policyVersion?: string | null;
  }) {
    if (!this.db) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Database not configured" }) }] };
    }

    try {
      const updates: string[] = [];
      const bindings: Array<string | null> = [];

      if (args.benchmarkStatus !== undefined) {
        updates.push("benchmark_status = ?");
        bindings.push(args.benchmarkStatus);
      }
      if (args.txHash !== undefined) {
        updates.push("tx_hash = ?");
        bindings.push(args.txHash);
      }
      if (args.onchainDecisionId !== undefined) {
        updates.push("onchain_decision_id = ?");
        bindings.push(args.onchainDecisionId);
      }
      if (args.requestedBy !== undefined) {
        updates.push("requested_by = ?");
        bindings.push(args.requestedBy);
      }
      if (args.dataSnapshotHash !== undefined) {
        updates.push("data_snapshot_hash = ?");
        bindings.push(args.dataSnapshotHash);
      }
      if (args.agentAddress !== undefined) {
        updates.push("agent_address = ?");
        bindings.push(args.agentAddress);
      }
      if (args.userId !== undefined) {
        updates.push("user_id = ?");
        bindings.push(args.userId);
      }
      if (args.vaultId !== undefined) {
        updates.push("vault_id = ?");
        bindings.push(args.vaultId);
      }
      if (args.policyVersion !== undefined) {
        updates.push("policy_version = ?");
        bindings.push(args.policyVersion);
      }

      if (updates.length === 0) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: "No benchmark fields provided" }) }]
        };
      }

      const stmt = this.db.prepare(`
        UPDATE decisions
        SET ${updates.join(", ")}
        WHERE decision_id = ?
      `);

      const result = await stmt.bind(...bindings, args.decisionId).run();

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            success: result.success,
            decisionId: args.decisionId
          })
        }]
      };
    } catch (e: any) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: e.message }) }]
      };
    }
  }
}
