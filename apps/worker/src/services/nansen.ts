export interface NansenNetflowToken {
  token_name: string;
  token_symbol: string;
  token_address: string;
  chain: string;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  smart_money_holders: number;
}

export interface NansenContextResult {
  status: "success" | "error" | "disabled";
  data?: NansenNetflowToken[];
  message?: string;
}

export type NansenCacheStatus = "fresh" | "stale" | "miss" | "negative";

export interface NansenPoolRequest {
  pool: string;
  symbol: string;
  project: string;
  underlyingTokens?: string[] | null;
  stablecoin?: boolean;
  exposure?: string | null;
}

export interface NansenPoolSummary {
  poolId: string;
  symbol: string;
  project: string;
  tokenAddresses: string[];
  tokens: NansenNetflowToken[];
  totalNetFlow24h: number;
  totalNetFlow7d: number;
  topToken: NansenNetflowToken | null;
  signal: "strong_inflow" | "moderate_inflow" | "neutral" | "outflow";
  cacheStatus: Record<string, NansenCacheStatus>;
}

export interface NansenBatchPoolResponse {
  status: "success" | "error" | "disabled";
  message?: string;
  fetchedAt: string;
  requestedPools: NansenPoolRequest[];
  tokensByAddress: Record<string, NansenNetflowToken[]>;
  poolSummaries: Record<string, NansenPoolSummary>;
  cacheStatus: Record<string, Record<string, NansenCacheStatus>>;
}

interface NansenCacheEntry {
  status: "success" | "negative";
  data: NansenNetflowToken[];
  fetchedAt: string;
  softExpiresAt: string;
  hardExpiresAt: string;
}

interface NansenCacheLookup {
  state: NansenCacheStatus | "expired";
  entry: NansenCacheEntry | null;
}

interface NansenBatchRequest {
  chain?: string;
  tokenAddresses: string[];
}

interface NansenBatchResult {
  status: "success" | "error" | "disabled";
  message?: string;
  fetchedAt: string;
  requestedTokenAddresses: string[];
  tokensByAddress: Record<string, NansenNetflowToken[]>;
  cacheStatusByAddress: Record<string, NansenCacheStatus>;
  upstreamCalled: boolean;
  upstreamStatus?: number;
}

const NANSEN_URL = "https://api.nansen.ai/api/v1/smart-money/netflow";
const NANSEN_SOFT_TTL_SECONDS = 10 * 60;
const NANSEN_HARD_TTL_SECONDS = 30 * 60;
const NANSEN_NEGATIVE_TTL_SECONDS = 5 * 60;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEAD_PLACEHOLDER = "0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111";

const toIso = (epochMs: number) => new Date(epochMs).toISOString();

const isExpired = (isoDate: string, nowMs: number) => Date.parse(isoDate) <= nowMs;

const isValidHexAddress = (value: string) => /^0x[a-f0-9]{40}$/.test(value);

const isPlaceholderAddress = (value: string) => value === ZERO_ADDRESS || value === DEAD_PLACEHOLDER;

export const normalizeTokenAddress = (value: string | null | undefined): string | null => {
  const normalized = value?.trim().toLowerCase() || "";
  if (!normalized || !isValidHexAddress(normalized) || isPlaceholderAddress(normalized)) {
    return null;
  }

  return normalized;
};

export const normalizeTokenAddresses = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.map((value) => normalizeTokenAddress(value)).filter((value): value is string => Boolean(value)))];

const cacheKeyFor = (chain: string, tokenAddress: string) => `nansen_token_${chain}_${tokenAddress}`;

const parseNansenToken = (token: any, fallbackChain: string): NansenNetflowToken => ({
  token_name: token.token_name || token.name || "Unknown",
  token_symbol: token.token_symbol || token.symbol || "???",
  token_address: normalizeTokenAddress(token.token_address || token.address) || "",
  chain: token.chain || fallbackChain,
  net_flow_1h_usd: token.net_flow_1h_usd || token.netflow_1h || 0,
  net_flow_24h_usd: token.net_flow_24h_usd || token.netflow_24h || 0,
  net_flow_7d_usd: token.net_flow_7d_usd || token.netflow_7d || 0,
  net_flow_30d_usd: token.net_flow_30d_usd || token.netflow_30d || 0,
  smart_money_holders: token.smart_money_holders || token.holders || 0,
});

const sumBy = (tokens: NansenNetflowToken[], field: "net_flow_24h_usd" | "net_flow_7d_usd") =>
  tokens.reduce((total, token) => total + token[field], 0);

export const buildPoolSummaries = (
  pools: NansenPoolRequest[],
  tokensByAddress: Record<string, NansenNetflowToken[]>,
  cacheStatusByAddress: Record<string, NansenCacheStatus>
): Record<string, NansenPoolSummary> => {
  const summaries: Record<string, NansenPoolSummary> = {};

  for (const pool of pools) {
    const tokenAddresses = normalizeTokenAddresses(pool.underlyingTokens || []);
    const tokens = tokenAddresses.flatMap((address) => tokensByAddress[address] || []);
    const dedupedTokens = [...new Map(tokens.map((token) => [token.token_address || `${token.token_symbol}:${token.chain}`, token])).values()];
    const topToken = [...dedupedTokens].sort((left, right) => right.net_flow_24h_usd - left.net_flow_24h_usd)[0] || null;
    const totalNetFlow24h = sumBy(dedupedTokens, "net_flow_24h_usd");
    const totalNetFlow7d = sumBy(dedupedTokens, "net_flow_7d_usd");
    const cacheStatus = Object.fromEntries(tokenAddresses.map((address) => [address, cacheStatusByAddress[address] || "miss"]));

    let signal: NansenPoolSummary["signal"] = "neutral";
    if (totalNetFlow24h > 1_000_000) signal = "strong_inflow";
    else if (totalNetFlow24h > 0) signal = "moderate_inflow";
    else if (totalNetFlow24h < 0) signal = "outflow";

    summaries[pool.pool] = {
      poolId: pool.pool,
      symbol: pool.symbol,
      project: pool.project,
      tokenAddresses,
      tokens: dedupedTokens,
      totalNetFlow24h,
      totalNetFlow7d,
      topToken,
      signal,
      cacheStatus,
    };
  }

  return summaries;
};

export class NansenService {
  constructor(private cacheKv: KVNamespace, private apiKey: string) {}

  private hasApiKey() {
    return Boolean(this.apiKey && this.apiKey !== "COLOQUE_SUA_CHAVE_DO_NANSEN_AQUI");
  }

  private async readCache(chain: string, tokenAddress: string): Promise<NansenCacheLookup> {
    const raw = await this.cacheKv.get(cacheKeyFor(chain, tokenAddress), "json");
    if (!raw || typeof raw !== "object") {
      return { state: "miss", entry: null };
    }

    const entry = raw as NansenCacheEntry;
    if (!entry.status || !entry.hardExpiresAt) {
      return { state: "miss", entry: null };
    }

    const nowMs = Date.now();
    if (isExpired(entry.hardExpiresAt, nowMs)) {
      return { state: "expired", entry };
    }

    if (entry.status === "negative") {
      return { state: "negative", entry };
    }

    if (isExpired(entry.softExpiresAt, nowMs)) {
      return { state: "stale", entry };
    }

    return { state: "fresh", entry };
  }

  private async writeCache(chain: string, tokenAddress: string, data: NansenNetflowToken[]) {
    const nowMs = Date.now();
    const entry: NansenCacheEntry = {
      status: "success",
      data,
      fetchedAt: toIso(nowMs),
      softExpiresAt: toIso(nowMs + NANSEN_SOFT_TTL_SECONDS * 1000),
      hardExpiresAt: toIso(nowMs + NANSEN_HARD_TTL_SECONDS * 1000),
    };

    await this.cacheKv.put(cacheKeyFor(chain, tokenAddress), JSON.stringify(entry), {
      expirationTtl: NANSEN_HARD_TTL_SECONDS,
    });
  }

  private async writeNegativeCache(chain: string, tokenAddress: string) {
    const nowMs = Date.now();
    const entry: NansenCacheEntry = {
      status: "negative",
      data: [],
      fetchedAt: toIso(nowMs),
      softExpiresAt: toIso(nowMs + NANSEN_NEGATIVE_TTL_SECONDS * 1000),
      hardExpiresAt: toIso(nowMs + NANSEN_NEGATIVE_TTL_SECONDS * 1000),
    };

    await this.cacheKv.put(cacheKeyFor(chain, tokenAddress), JSON.stringify(entry), {
      expirationTtl: NANSEN_NEGATIVE_TTL_SECONDS,
    });
  }

  private async fetchUpstream(chain: string, tokenAddresses: string[]) {
    return fetch(NANSEN_URL, {
      method: "POST",
      headers: {
        apikey: this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chains: [chain],
        filters: {
          include_stablecoins: true,
          token_addresses: tokenAddresses,
        },
        pagination: {
          page: 1,
          per_page: tokenAddresses.length,
        },
        order_by: [{ field: "net_flow_24h_usd", direction: "DESC" }],
      }),
    });
  }

  async getSmartMoneyFlowsBatch(args: NansenBatchRequest): Promise<NansenBatchResult> {
    const chain = args.chain || "mantle";
    const requestedTokenAddresses = normalizeTokenAddresses(args.tokenAddresses);

    if (!this.hasApiKey()) {
      return {
        status: "disabled",
        message: "Nansen API Key is not configured. Smart money context is disabled.",
        fetchedAt: toIso(Date.now()),
        requestedTokenAddresses,
        tokensByAddress: {},
        cacheStatusByAddress: {},
        upstreamCalled: false,
      };
    }

    if (requestedTokenAddresses.length === 0) {
      return {
        status: "error",
        message: "No valid token addresses were provided for Nansen lookup.",
        fetchedAt: toIso(Date.now()),
        requestedTokenAddresses,
        tokensByAddress: {},
        cacheStatusByAddress: {},
        upstreamCalled: false,
      };
    }

    const tokensByAddress: Record<string, NansenNetflowToken[]> = {};
    const cacheStatusByAddress: Record<string, NansenCacheStatus> = {};
    const refreshCandidates: string[] = [];
    let cacheHitCount = 0;
    let cacheStaleCount = 0;
    let cacheMissCount = 0;
    let negativeCacheCount = 0;

    for (const tokenAddress of requestedTokenAddresses) {
      const cached = await this.readCache(chain, tokenAddress);
      if (cached.state === "fresh" && cached.entry) {
        tokensByAddress[tokenAddress] = cached.entry.data;
        cacheStatusByAddress[tokenAddress] = "fresh";
        cacheHitCount += 1;
      } else if (cached.state === "stale" && cached.entry) {
        tokensByAddress[tokenAddress] = cached.entry.data;
        cacheStatusByAddress[tokenAddress] = "stale";
        refreshCandidates.push(tokenAddress);
        cacheStaleCount += 1;
      } else if (cached.state === "negative" && cached.entry) {
        tokensByAddress[tokenAddress] = [];
        cacheStatusByAddress[tokenAddress] = "negative";
        negativeCacheCount += 1;
      } else {
        tokensByAddress[tokenAddress] = [];
        cacheStatusByAddress[tokenAddress] = "miss";
        refreshCandidates.push(tokenAddress);
        cacheMissCount += 1;
      }
    }

    let status: NansenBatchResult["status"] = "success";
    let message: string | undefined;
    let upstreamStatus: number | undefined;

    if (refreshCandidates.length > 0) {
      try {
        const response = await this.fetchUpstream(chain, refreshCandidates);
        upstreamStatus = response.status;

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Nansen API ${response.status}: ${errorText.substring(0, 200)}`);
        }

        const json = (await response.json()) as any;
        const parsedTokens = ((json.data || json || []) as any[])
          .map((token) => parseNansenToken(token, chain))
          .filter((token) => Boolean(token.token_address));

        const upstreamByAddress = parsedTokens.reduce<Record<string, NansenNetflowToken[]>>((acc, token) => {
          const normalizedAddress = normalizeTokenAddress(token.token_address);
          if (!normalizedAddress) {
            return acc;
          }

          if (!acc[normalizedAddress]) {
            acc[normalizedAddress] = [];
          }

          acc[normalizedAddress].push({ ...token, token_address: normalizedAddress });
          return acc;
        }, {});

        await Promise.all(refreshCandidates.map(async (tokenAddress) => {
          const nextTokens = upstreamByAddress[tokenAddress] || [];
          if (nextTokens.length > 0) {
            tokensByAddress[tokenAddress] = nextTokens;
            cacheStatusByAddress[tokenAddress] = "fresh";
            await this.writeCache(chain, tokenAddress, nextTokens);
            return;
          }

          if (cacheStatusByAddress[tokenAddress] === "miss") {
            tokensByAddress[tokenAddress] = [];
            cacheStatusByAddress[tokenAddress] = "negative";
            await this.writeNegativeCache(chain, tokenAddress);
          }
        }));
      } catch (error: any) {
        const hasCachedData = Object.values(cacheStatusByAddress).some((cacheStatus) => cacheStatus === "fresh" || cacheStatus === "stale");
        if (hasCachedData) {
          status = "success";
          message = `Serving cached Nansen data after upstream failure: ${error.message}`;
        } else {
          status = "error";
          message = `Failed to fetch from Nansen: ${error.message}`;
        }
      }
    }

    console.log(JSON.stringify({
      event: "nansen.batch",
      chain,
      requestedTokenCount: requestedTokenAddresses.length,
      cacheHitCount,
      cacheStaleCount,
      cacheMissCount,
      negativeCacheCount,
      upstreamCalled: refreshCandidates.length > 0,
      upstreamStatus,
      status,
    }));

    return {
      status,
      message,
      fetchedAt: toIso(Date.now()),
      requestedTokenAddresses,
      tokensByAddress,
      cacheStatusByAddress,
      upstreamCalled: refreshCandidates.length > 0,
      upstreamStatus,
    };
  }

  async getSmartMoneyFlows(tokenAddress: string, chain: string = "mantle"): Promise<NansenContextResult> {
    const normalizedAddress = normalizeTokenAddress(tokenAddress);
    if (!normalizedAddress) {
      return {
        status: "error",
        message: "A valid token address is required to query Nansen Smart Money flows.",
      };
    }

    const result = await this.getSmartMoneyFlowsBatch({
      chain,
      tokenAddresses: [normalizedAddress],
    });

    if (result.status !== "success") {
      return {
        status: result.status,
        message: result.message,
      };
    }

    return {
      status: "success",
      data: result.tokensByAddress[normalizedAddress] || [],
      message: result.message,
    };
  }

  async buildBatchPoolResponse(pools: NansenPoolRequest[], chain: string = "mantle"): Promise<NansenBatchPoolResponse> {
    const requestedPools = pools.map((pool) => ({
      pool: pool.pool,
      symbol: pool.symbol,
      project: pool.project,
      underlyingTokens: normalizeTokenAddresses(pool.underlyingTokens || []),
      stablecoin: pool.stablecoin,
      exposure: pool.exposure,
    }));

    const batch = await this.getSmartMoneyFlowsBatch({
      chain,
      tokenAddresses: requestedPools.flatMap((pool) => pool.underlyingTokens || []),
    });

    const poolSummaries = buildPoolSummaries(requestedPools, batch.tokensByAddress, batch.cacheStatusByAddress);
    const cacheStatus = Object.fromEntries(
      requestedPools.map((pool) => [pool.pool, poolSummaries[pool.pool]?.cacheStatus || {}])
    );

    return {
      status: batch.status,
      message: batch.message,
      fetchedAt: batch.fetchedAt,
      requestedPools,
      tokensByAddress: batch.tokensByAddress,
      poolSummaries,
      cacheStatus,
    };
  }
}
