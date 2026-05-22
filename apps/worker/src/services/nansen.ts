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

export class NansenService {
  constructor(private cacheKv: KVNamespace, private apiKey: string) {}

  /**
   * Fetches Smart Money netflows for a given chain.
   * Nansen API v1: POST https://api.nansen.ai/api/v1/smart-money/netflow
   * Auth header: apikey: <key>
   */
  async getSmartMoneyFlows(tokenSymbol: string, chain: string = "mantle"): Promise<NansenContextResult> {
    if (!this.apiKey || this.apiKey === "COLOQUE_SUA_CHAVE_DO_NANSEN_AQUI") {
      return {
        status: "disabled",
        message: "Nansen API Key is not configured. Smart money context is disabled."
      };
    }

    const cacheKey = `nansen_netflow_${chain}_${tokenSymbol}`;
    const cached = await this.cacheKv.get(cacheKey, "json");
    if (cached) {
      return { status: "success", data: cached as NansenNetflowToken[] };
    }

    try {
      const url = `https://api.nansen.ai/api/v1/smart-money/netflow`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "apikey": this.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chains: [chain],
          filters: {
            include_stablecoins: true
          },
          pagination: {
            page: 1,
            page_size: 20
          },
          order_by: [
            { field: "net_flow_24h_usd", direction: "DESC" }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          status: "error",
          message: `Nansen API ${response.status}: ${errorText.substring(0, 200)}`
        };
      }

      const json = await response.json() as any;
      
      // Parse Nansen response — standard envelope is { data: [...] }
      const tokens: NansenNetflowToken[] = (json.data || json || []).map((t: any) => ({
        token_name: t.token_name || t.name || "Unknown",
        token_symbol: t.token_symbol || t.symbol || "???",
        token_address: t.token_address || t.address || "",
        chain: t.chain || chain,
        net_flow_1h_usd: t.net_flow_1h_usd || t.netflow_1h || 0,
        net_flow_24h_usd: t.net_flow_24h_usd || t.netflow_24h || 0,
        net_flow_7d_usd: t.net_flow_7d_usd || t.netflow_7d || 0,
        net_flow_30d_usd: t.net_flow_30d_usd || t.netflow_30d || 0,
        smart_money_holders: t.smart_money_holders || t.holders || 0
      }));

      // Cache for 10 minutes
      await this.cacheKv.put(cacheKey, JSON.stringify(tokens), { expirationTtl: 600 });

      return { status: "success", data: tokens };
    } catch (e: any) {
      return {
        status: "error",
        message: `Failed to fetch from Nansen: ${e.message}`
      };
    }
  }
}
