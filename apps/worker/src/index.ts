import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DefiLlamaService } from "./services/defillama";
import { FredService } from "./services/fred";
import { NansenService } from "./services/nansen";
import {
  McpToolHandlers,
  yieldScanSchema,
  tbillSpreadSchema,
  nansenContextSchema,
  riskAssessSchema,
  optimalAllocationSchema,
  logDecisionSchema,
  getDecisionsSchema
} from "./mcp/tools";

export interface Env {
  CACHE_KV: KVNamespace;
  DECISIONS_DB: D1Database;
  MCP_OBJECT: DurableObjectNamespace;
  FRED_API_KEY: string;
  NANSEN_API_KEY: string;
  STABLESYNC_BENCHMARK_CONTRACT: string;
}

export class StableSyncMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "stablesync-mcp",
    version: "1.0.0"
  });

  async init() {
    // Initialize Services
    const defillama = new DefiLlamaService(this.env.CACHE_KV);
    const fred = new FredService(this.env.CACHE_KV, this.env.FRED_API_KEY);
    const nansen = new NansenService(this.env.CACHE_KV, this.env.NANSEN_API_KEY);
    const handlers = new McpToolHandlers(defillama, fred, nansen, this.env.DECISIONS_DB);

    // Register Tools
    this.server.tool(
      "yield_scan",
      "Scans Mantle DeFi pools for current APY and TVL via DefiLlama",
      yieldScanSchema,
      handlers.handleYieldScan.bind(handlers)
    );

    this.server.tool(
      "tbill_spread",
      "Calculates the spread (in bps) between a given DeFi pool APY and the real-time US 3-Month T-Bill rate",
      tbillSpreadSchema,
      handlers.handleTbillSpread.bind(handlers)
    );

    this.server.tool(
      "nansen_context",
      "Fetches Smart Money inflows/outflows for a specific token via Nansen API",
      nansenContextSchema,
      handlers.handleNansenContext.bind(handlers)
    );

    this.server.tool(
      "risk_assess",
      "Performs a deterministic risk assessment returning a score (0-100) and classification",
      riskAssessSchema,
      handlers.handleRiskAssess.bind(handlers)
    );

    this.server.tool(
      "optimal_allocation",
      "Calculates an optimal allocation of funds across Mantle pools based on risk profile",
      optimalAllocationSchema,
      handlers.handleOptimalAllocation.bind(handlers)
    );

    this.server.tool(
      "log_decision",
      "Logs a decision to the database",
      logDecisionSchema,
      handlers.handleLogDecision.bind(handlers)
    );

    this.server.tool(
      "get_decisions",
      "Fetches the latest decisions from the database",
      getDecisionsSchema,
      handlers.handleGetDecisions.bind(handlers)
    );
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    };

    // REST API Routes for Frontend
    if (url.pathname.startsWith("/api/")) {
      try {
        const defillama = new DefiLlamaService(env.CACHE_KV);
        const fred = new FredService(env.CACHE_KV, env.FRED_API_KEY);
        const nansen = new NansenService(env.CACHE_KV, env.NANSEN_API_KEY);
        const handlers = new McpToolHandlers(defillama, fred, nansen, env.DECISIONS_DB);

        if (url.pathname === "/api/yields" && request.method === "GET") {
          const res = await handlers.handleYieldScan({ minTvlUsd: 100000, chainFilter: "Mantle" });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/tbill-spread" && request.method === "GET") {
          const apy = parseFloat(url.searchParams.get("apy") || "0");
          const res = await handlers.handleTbillSpread({ apy });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname.startsWith("/api/nansen/") && request.method === "GET") {
          const tokenAddress = url.pathname.split("/").pop() || "";
          const res = await handlers.handleNansenContext({ tokenAddress, chain: "mantle" });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/risk-assess" && request.method === "POST") {
          const body = await request.json() as any;
          const res = await handlers.handleRiskAssess({
            protocolTvlUsd: body.protocolTvlUsd,
            apy: body.apy,
            apyBase: body.apyBase || 0,
            apyReward: body.apyReward || 0,
            volumeUsd1d: body.volumeUsd1d !== undefined ? body.volumeUsd1d : null,
            volumeUsd7d: body.volumeUsd7d !== undefined ? body.volumeUsd7d : null,
            apyMean30d: body.apyMean30d || 0,
            apyPct1D: body.apyPct1D || 0,
            apyPct7D: body.apyPct7D || 0,
            ilRisk: body.ilRisk || "no",
            stablecoin: body.stablecoin || false,
            sigma: body.sigma || 0,
            nansenSmartMoneyNetFlow: body.nansenSmartMoneyNetFlow || 0
          });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/allocation" && request.method === "POST") {
          const body = await request.json() as any;
          const res = await handlers.handleOptimalAllocation({
            amountUsd: body.amountUsd || 10000,
            riskProfile: body.riskProfile || "medium",
            horizonHours: body.horizonHours || 24
          });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/decisions" && request.method === "GET") {
          const res = await handlers.handleGetDecisions({ limit: 50 });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/decisions" && request.method === "POST") {
          const body = await request.json() as any;
          const res = await handlers.handleLogDecision(body);
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/decisions" && request.method === "DELETE") {
          if (!env.DECISIONS_DB) throw new Error("DB not configured");
          await env.DECISIONS_DB.prepare("DELETE FROM decisions").run();
          return new Response(JSON.stringify({ success: true, message: "Ledger cleared" }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: "Endpoint not found" }), { status: 404, headers: corsHeaders });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Pass MCP requests to the durable object
    if (url.pathname.startsWith("/mcp")) {
      const mcpResponse = await (StableSyncMcpAgent as any).serve("/mcp").fetch(request, env, ctx);
      // We must add CORS headers to the SSE response if the frontend tries to connect via EventSource
      const newHeaders = new Headers(mcpResponse.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      return new Response(mcpResponse.body, {
        status: mcpResponse.status,
        statusText: mcpResponse.statusText,
        headers: newHeaders
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
