export interface DefiLlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  // Extended fields for risk model
  ilRisk: string | null;
  exposure: string | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  apyMean30d: number | null;
  stablecoin: boolean;
  mu: number | null;
  sigma: number | null;
  count: number | null;
  outlier: boolean;
  predictedClass: string | null;
  predictedProbability: number | null;
}

export interface DefiLlamaResponse {
  status: string;
  data: DefiLlamaPool[];
}

export class DefiLlamaService {
  constructor(private cacheKv: KVNamespace) {}

  async getPools(chainFilter = "Mantle", minTvlUsd = 100000): Promise<DefiLlamaPool[]> {
    const cacheKey = `defillama_pools_${chainFilter}_${minTvlUsd}`;
    
    // Check Cache
    const cached = await this.cacheKv.get(cacheKey, "json");
    if (cached) {
      return cached as DefiLlamaPool[];
    }

    // Fetch from DefiLlama
    const response = await fetch("https://yields.llama.fi/pools");
    if (!response.ok) {
      throw new Error(`DefiLlama API error: ${response.statusText}`);
    }

    const json = (await response.json()) as DefiLlamaResponse;
    
    // Filter
    const filtered = json.data.filter(
      p => p.chain.toLowerCase() === chainFilter.toLowerCase() && p.tvlUsd >= minTvlUsd
    );

    // Sort by TVL descending
    filtered.sort((a, b) => b.tvlUsd - a.tvlUsd);

    // Cache for 5 minutes
    await this.cacheKv.put(cacheKey, JSON.stringify(filtered), { expirationTtl: 300 });

    return filtered;
  }
}
