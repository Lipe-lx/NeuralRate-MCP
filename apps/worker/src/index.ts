import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DefiLlamaService } from "./services/defillama";
import { FredService } from "./services/fred";
import { NansenService } from "./services/nansen";
import { AutomationStore } from "./automation";
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
  NEURALRATE_BENCHMARK_CONTRACT: string;
}

const MCP_CANONICAL_ROUTE = "/mcp";
const MCP_SSE_ALIAS_ROUTE = "/sse";

export class NeuralRateMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp",
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
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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
        const automation = new AutomationStore(env.DECISIONS_DB);

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
            ownerEoa: body.ownerEoa,
            amountUsd: body.amountUsd || 10000,
            objective: body.objective || "income",
            riskProfile: body.riskProfile || "medium",
            horizonHours: body.horizonHours || 24,
            allowedAssets: body.allowedAssets || [],
            deniedAssets: body.deniedAssets || [],
            allowedProtocols: body.allowedProtocols || [],
            deniedProtocols: body.deniedProtocols || [],
            maxProtocolWeightBps: body.maxProtocolWeightBps,
            maxAssetWeightBps: body.maxAssetWeightBps,
            maxActionUsd: body.maxActionUsd,
            stableOnly: body.stableOnly,
            minSpreadOverTbillBps: body.minSpreadOverTbillBps,
            automationMode: body.automationMode || "recommend-only",
            restrictionPreset: body.restrictionPreset || "blue-chip-defi",
          });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/users/bootstrap" && request.method === "POST") {
          const body = await request.json() as any;
          const state = await automation.bootstrapUser({
            ownerEoa: body.ownerEoa,
            externalWallet: body.externalWallet,
            embeddedWallet: body.embeddedWallet,
            authStrategy: body.authStrategy,
            displayName: body.displayName,
            privyUserId: body.privyUserId,
            providerUserRef: body.providerUserRef,
            walletProvider: body.walletProvider,
            vaultAddress: body.vaultAddress,
            vaultProvider: body.vaultProvider,
            vaultKind: body.vaultKind,
            vaultStatus: body.vaultStatus,
            safeDeploymentStatus: body.safeDeploymentStatus,
            safeSaltNonce: body.safeSaltNonce,
            chainId: body.chainId,
          });

          return new Response(JSON.stringify({ success: true, state }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/agent-config" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const config = await automation.getAgentConfig(ownerEoa);
          return new Response(JSON.stringify({ success: true, config }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/agent-config" && request.method === "PATCH") {
          const body = await request.json() as any;
          const config = await automation.upsertAgentConfig({
            ownerEoa: body.ownerEoa,
            userId: body.userId,
            vaultId: body.vaultId,
            objective: body.objective,
            riskProfile: body.riskProfile,
            horizonHours: body.horizonHours,
            automationMode: body.automationMode,
            restrictionPreset: body.restrictionPreset,
            allowedAssets: body.allowedAssets,
            deniedAssets: body.deniedAssets,
            allowedProtocols: body.allowedProtocols,
            deniedProtocols: body.deniedProtocols,
            maxProtocolWeightBps: body.maxProtocolWeightBps,
            maxAssetWeightBps: body.maxAssetWeightBps,
            maxActionUsd: body.maxActionUsd,
            maxDailyUsd: body.maxDailyUsd,
            maxAutomationUsd: body.maxAutomationUsd,
            maxSlippageBps: body.maxSlippageBps,
            rebalanceCadenceHours: body.rebalanceCadenceHours,
            minApyBps: body.minApyBps,
            minSpreadOverTbillBps: body.minSpreadOverTbillBps,
            requireManualAboveUsd: body.requireManualAboveUsd,
            pauseOnRiskEvent: body.pauseOnRiskEvent,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, config }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/vault" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const vault = await automation.getVault(ownerEoa);
          return new Response(JSON.stringify({ success: true, vault }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/vault/funding-intent" && request.method === "POST") {
          const body = await request.json() as any;
          const vault = await automation.createFundingIntent({
            ownerEoa: body.ownerEoa,
            amountUsd: body.amountUsd,
            source: body.source,
          });

          return new Response(JSON.stringify({ success: true, vault }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/decisions" && request.method === "GET") {
          const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
          const ownerEoa = url.searchParams.get("ownerEoa") || undefined;
          const res = await handlers.handleGetDecisions({
            limit: Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 50,
            ownerEoa,
          });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/decisions" && request.method === "POST") {
          const body = await request.json() as any;
          const res = await handlers.handleLogDecision(body);
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        const benchmarkMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)\/benchmark$/);
        if (benchmarkMatch && request.method === "PATCH") {
          const body = await request.json() as any;
          const res = await handlers.handleUpdateDecisionBenchmark({
            decisionId: decodeURIComponent(benchmarkMatch[1]),
            benchmarkStatus: body.benchmarkStatus,
            txHash: body.txHash,
            onchainDecisionId: body.onchainDecisionId,
            requestedBy: body.requestedBy,
            dataSnapshotHash: body.dataSnapshotHash,
            agentAddress: body.agentAddress,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/benchmark/history" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
          const decisions = await automation.listBenchmarkHistory(
            ownerEoa,
            Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 50
          );
          return new Response(JSON.stringify({ success: true, decisions }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/decisions" && request.method === "DELETE") {
          if (!env.DECISIONS_DB) throw new Error("DB not configured");
          await env.DECISIONS_DB.prepare("DELETE FROM decisions").run();
          return new Response(JSON.stringify({ success: true, message: "Ledger cleared" }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/state" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const state = await automation.getAutomationState(ownerEoa);
          return new Response(JSON.stringify(state), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/accounts" && request.method === "POST") {
          const body = await request.json() as any;
          const account = await automation.upsertAccount({
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            chainId: body.chainId,
            accountProvider: body.accountProvider,
            accountKind: body.accountKind,
            deploymentStatus: body.deploymentStatus,
            userId: body.userId,
            vaultId: body.vaultId,
          });

          return new Response(JSON.stringify({ success: true, account }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/policies" && request.method === "POST") {
          const body = await request.json() as any;
          const policy = await automation.upsertPolicy({
            policyId: body.policyId,
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            chainId: body.chainId,
            policyVersion: body.policyVersion,
            domain: body.domain,
            status: body.status,
            allowedContracts: body.allowedContracts,
            allowedSelectors: body.allowedSelectors,
            allowedAssets: body.allowedAssets,
            allowedProtocols: body.allowedProtocols,
            spendToken: body.spendToken,
            spendLimitPerUse: body.spendLimitPerUse,
            spendLimitDaily: body.spendLimitDaily,
            spendLimitTotal: body.spendLimitTotal,
            usageLimit: body.usageLimit,
            validAfter: body.validAfter,
            validUntil: body.validUntil,
            humanSummary: body.humanSummary,
            rawPolicy: body.rawPolicy,
            userId: body.userId,
            vaultId: body.vaultId,
          });

          return new Response(JSON.stringify({ success: true, policy }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/sessions" && request.method === "POST") {
          const body = await request.json() as any;
          const session = await automation.upsertSession({
            sessionId: body.sessionId,
            policyId: body.policyId,
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            agentSessionSigner: body.agentSessionSigner,
            chainId: body.chainId,
            sessionStatus: body.sessionStatus,
            grantTxHash: body.grantTxHash,
            revokeTxHash: body.revokeTxHash,
            permissionId: body.permissionId,
            sessionDetails: body.sessionDetails,
            validAfter: body.validAfter,
            validUntil: body.validUntil,
            revokedAt: body.revokedAt,
            providerSessionRef: body.providerSessionRef,
            providerPermissionRef: body.providerPermissionRef,
            consentMessage: body.consentMessage,
            consentSignature: body.consentSignature,
            turnkeySignerRef: body.turnkeySignerRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, session }), { headers: corsHeaders });
        }

        const activateSessionMatch = url.pathname.match(/^\/api\/automation\/sessions\/([^/]+)\/activate$/);
        if (activateSessionMatch && request.method === "POST") {
          const body = await request.json() as any;
          const session = await automation.upsertSession({
            sessionId: decodeURIComponent(activateSessionMatch[1]),
            policyId: body.policyId,
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            agentSessionSigner: body.agentSessionSigner,
            chainId: body.chainId,
            sessionStatus: "active",
            grantTxHash: body.grantTxHash,
            permissionId: body.permissionId,
            sessionDetails: body.sessionDetails,
            validAfter: body.validAfter,
            validUntil: body.validUntil,
            providerSessionRef: body.providerSessionRef,
            providerPermissionRef: body.providerPermissionRef,
            consentMessage: body.consentMessage,
            consentSignature: body.consentSignature,
            turnkeySignerRef: body.turnkeySignerRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, session }), { headers: corsHeaders });
        }

        const revokeSessionMatch = url.pathname.match(/^\/api\/automation\/sessions\/([^/]+)\/revoke$/);
        if (revokeSessionMatch && request.method === "POST") {
          const body = await request.json() as any;
          const session = await automation.upsertSession({
            sessionId: decodeURIComponent(revokeSessionMatch[1]),
            policyId: body.policyId,
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            agentSessionSigner: body.agentSessionSigner,
            chainId: body.chainId,
            sessionStatus: body.sessionStatus || "revoked",
            grantTxHash: body.grantTxHash,
            revokeTxHash: body.revokeTxHash,
            permissionId: body.permissionId,
            sessionDetails: body.sessionDetails,
            validAfter: body.validAfter,
            validUntil: body.validUntil,
            revokedAt: body.revokedAt || new Date().toISOString(),
            providerSessionRef: body.providerSessionRef,
            providerPermissionRef: body.providerPermissionRef,
            consentMessage: body.consentMessage,
            consentSignature: body.consentSignature,
            turnkeySignerRef: body.turnkeySignerRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, session }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/jobs" && request.method === "POST") {
          const body = await request.json() as any;
          const job = await automation.upsertAutomationJob({
            jobId: body.jobId,
            sessionId: body.sessionId,
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            executionDomain: body.executionDomain,
            jobType: body.jobType,
            targetContract: body.targetContract,
            targetSelector: body.targetSelector,
            payload: body.payload,
            status: body.status,
            txHash: body.txHash,
            failureReason: body.failureReason,
            providerJobRef: body.providerJobRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, job }), { headers: corsHeaders });
        }

        const automationJobMatch = url.pathname.match(/^\/api\/automation\/jobs\/([^/]+)$/);
        if (automationJobMatch && request.method === "PATCH") {
          const body = await request.json() as any;
          const job = await automation.upsertAutomationJob({
            jobId: decodeURIComponent(automationJobMatch[1]),
            sessionId: body.sessionId,
            ownerEoa: body.ownerEoa,
            userSmartAccount: body.userSmartAccount,
            executionDomain: body.executionDomain,
            jobType: body.jobType,
            targetContract: body.targetContract,
            targetSelector: body.targetSelector,
            payload: body.payload,
            status: body.status,
            txHash: body.txHash,
            failureReason: body.failureReason,
            providerJobRef: body.providerJobRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, job }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/benchmark-jobs" && request.method === "POST") {
          const body = await request.json() as any;
          const benchmarkJob = await automation.upsertBenchmarkJob({
            benchmarkJobId: body.benchmarkJobId,
            decisionId: body.decisionId,
            ownerEoa: body.ownerEoa,
            agentSmartWallet: body.agentSmartWallet,
            sessionId: body.sessionId,
            status: body.status,
            txHash: body.txHash,
            onchainDecisionId: body.onchainDecisionId,
            dataSnapshotHash: body.dataSnapshotHash,
            payload: body.payload,
            failureReason: body.failureReason,
            providerJobRef: body.providerJobRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, benchmarkJob }), { headers: corsHeaders });
        }

        const benchmarkJobMatch = url.pathname.match(/^\/api\/benchmark-jobs\/([^/]+)$/);
        if (benchmarkJobMatch && request.method === "PATCH") {
          const body = await request.json() as any;
          const benchmarkJob = await automation.upsertBenchmarkJob({
            benchmarkJobId: decodeURIComponent(benchmarkJobMatch[1]),
            decisionId: body.decisionId,
            ownerEoa: body.ownerEoa,
            agentSmartWallet: body.agentSmartWallet,
            sessionId: body.sessionId,
            status: body.status,
            txHash: body.txHash,
            onchainDecisionId: body.onchainDecisionId,
            dataSnapshotHash: body.dataSnapshotHash,
            payload: body.payload,
            failureReason: body.failureReason,
            providerJobRef: body.providerJobRef,
            userId: body.userId,
            vaultId: body.vaultId,
            policyVersion: body.policyVersion,
          });

          return new Response(JSON.stringify({ success: true, benchmarkJob }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: "Endpoint not found" }), { status: 404, headers: corsHeaders });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Accept /mcp as canonical and /sse as a transport alias for existing clients.
    if (url.pathname.startsWith(MCP_CANONICAL_ROUTE) || url.pathname.startsWith(MCP_SSE_ALIAS_ROUTE)) {
      const targetUrl = new URL(request.url);
      if (targetUrl.pathname.startsWith(MCP_SSE_ALIAS_ROUTE)) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SSE_ALIAS_ROUTE, MCP_CANONICAL_ROUTE);
      }

      const mcpRequest = targetUrl.toString() === request.url
        ? request
        : new Request(targetUrl.toString(), request);

      const mcpResponse = await (NeuralRateMcpAgent as any).serve(MCP_CANONICAL_ROUTE).fetch(mcpRequest, env, ctx);
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
