import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DefiLlamaService } from "./services/defillama";
import { FredService } from "./services/fred";
import { NansenService } from "./services/nansen";
import { AutomationStore } from "./automation";
import {
  issueMutationNonce,
  isInternalMutationRequest,
  type MutationAuthEnvelope,
  verifyMutationAuthEnvelope,
} from "./auth";
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
  INTERNAL_API_TOKEN?: string;
}

const MCP_CANONICAL_ROUTE = "/mcp";
const MCP_SSE_ALIAS_ROUTE = "/sse";

const readJsonBody = async <T>(request: Request) => (await request.json()) as T;

const getAuthEnvelope = (body: unknown) => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const auth = (body as Record<string, unknown>).auth;
  if (!auth || typeof auth !== "object") {
    return null;
  }

  const envelope = auth as Record<string, unknown>;
  if (
    typeof envelope.ownerEoa !== "string" ||
    typeof envelope.nonce !== "string" ||
    typeof envelope.issuedAt !== "string" ||
    typeof envelope.expiresAt !== "string" ||
    typeof envelope.signature !== "string"
  ) {
    return null;
  }

  return envelope as unknown as MutationAuthEnvelope;
};

const resolveMutationOwner = (body: Record<string, unknown>, field = "ownerEoa") => {
  const value = body[field];
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (field !== "requestedBy") {
    return resolveMutationOwner(body, "requestedBy");
  }

  return null;
};

const assertMutationAuthorized = async (
  request: Request,
  env: Env,
  body: Record<string, unknown>,
  expectedOwner: string
) => {
  if (isInternalMutationRequest(request, env.INTERNAL_API_TOKEN ?? null)) {
    return { mode: "internal" as const, ownerEoa: expectedOwner.toLowerCase() };
  }

  const auth = getAuthEnvelope(body);
  if (!auth) {
    throw new Error("Missing signed mutation auth envelope.");
  }

  const verified = await verifyMutationAuthEnvelope(env.DECISIONS_DB, auth, expectedOwner);
  return { mode: "signed" as const, ownerEoa: verified.ownerEoa };
};

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
          "Access-Control-Allow-Headers": "Content-Type, X-NeuralRate-Internal-Token",
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

        if (url.pathname === "/api/auth/nonce" && request.method === "POST") {
          const body = await readJsonBody<{ ownerEoa?: string }>(request);
          if (!body.ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const challenge = await issueMutationNonce(env.DECISIONS_DB, body.ownerEoa);
          return new Response(JSON.stringify({ success: true, challenge }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/auth/verify" && request.method === "POST") {
          const body = await readJsonBody<{ ownerEoa?: string; auth?: MutationAuthEnvelope }>(request);
          if (!body.ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const auth = getAuthEnvelope(body as unknown as Record<string, unknown>);
          if (!auth) {
            return new Response(JSON.stringify({ error: "auth is required" }), { status: 400, headers: corsHeaders });
          }

          const verified = await verifyMutationAuthEnvelope(env.DECISIONS_DB, auth, body.ownerEoa);
          return new Response(JSON.stringify({ success: true, verified }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/yields" && request.method === "GET") {
          const res = await handlers.handleYieldScan({ minTvlUsd: 100000, chainFilter: "Mantle" });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        const yieldsChartMatch = url.pathname.match(/^\/api\/yields\/chart\/([^/]+)$/);
        if (yieldsChartMatch && request.method === "GET") {
          const data = await defillama.getPoolChart(decodeURIComponent(yieldsChartMatch[1]));
          return new Response(JSON.stringify({ data }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/tbill-spread" && request.method === "GET") {
          const apy = parseFloat(url.searchParams.get("apy") || "0");
          const res = await handlers.handleTbillSpread({ apy });
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        if (url.pathname === "/api/nansen/batch" && request.method === "POST") {
          const body = await request.json() as {
            chain?: string;
            pools?: Array<{
              pool: string;
              symbol: string;
              project: string;
              underlyingTokens?: string[] | null;
              stablecoin?: boolean;
              exposure?: string | null;
            }>;
          };

          const result = await nansen.buildBatchPoolResponse(body.pools || [], body.chain || "mantle");
          return new Response(JSON.stringify(result), { headers: corsHeaders });
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
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const state = await automation.bootstrapUser({
            ownerEoa,
            externalWallet: typeof body.externalWallet === "string" ? body.externalWallet : undefined,
            embeddedWallet: typeof body.embeddedWallet === "string" ? body.embeddedWallet : undefined,
            authStrategy: typeof body.authStrategy === "string" ? body.authStrategy : undefined,
            displayName: typeof body.displayName === "string" ? body.displayName : undefined,
            privyUserId: typeof body.privyUserId === "string" ? body.privyUserId : undefined,
            providerUserRef: typeof body.providerUserRef === "string" ? body.providerUserRef : undefined,
            walletProvider: typeof body.walletProvider === "string" ? body.walletProvider : undefined,
            vaultAddress: typeof body.vaultAddress === "string" ? body.vaultAddress : undefined,
            vaultProvider: typeof body.vaultProvider === "string" ? body.vaultProvider : undefined,
            vaultKind: typeof body.vaultKind === "string" ? body.vaultKind : undefined,
            vaultStatus: typeof body.vaultStatus === "string" ? body.vaultStatus : undefined,
            safeDeploymentStatus: typeof body.safeDeploymentStatus === "string" ? body.safeDeploymentStatus : undefined,
            safeSaltNonce: typeof body.safeSaltNonce === "string" ? body.safeSaltNonce : undefined,
            chainId: typeof body.chainId === "number" ? body.chainId : undefined,
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
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const config = await automation.upsertAgentConfig({
            ownerEoa,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            objective: body.objective as any,
            riskProfile: body.riskProfile as any,
            horizonHours: typeof body.horizonHours === "number" ? body.horizonHours : undefined,
            automationMode: body.automationMode as any,
            restrictionPreset: body.restrictionPreset as any,
            allowedAssets: Array.isArray(body.allowedAssets) ? body.allowedAssets as string[] : undefined,
            deniedAssets: Array.isArray(body.deniedAssets) ? body.deniedAssets as string[] : undefined,
            allowedProtocols: Array.isArray(body.allowedProtocols) ? body.allowedProtocols as string[] : undefined,
            deniedProtocols: Array.isArray(body.deniedProtocols) ? body.deniedProtocols as string[] : undefined,
            maxProtocolWeightBps: typeof body.maxProtocolWeightBps === "number" ? body.maxProtocolWeightBps : undefined,
            maxAssetWeightBps: typeof body.maxAssetWeightBps === "number" ? body.maxAssetWeightBps : undefined,
            maxActionUsd: typeof body.maxActionUsd === "number" ? body.maxActionUsd : undefined,
            maxDailyUsd: typeof body.maxDailyUsd === "number" ? body.maxDailyUsd : undefined,
            maxAutomationUsd: typeof body.maxAutomationUsd === "number" ? body.maxAutomationUsd : undefined,
            maxSlippageBps: typeof body.maxSlippageBps === "number" ? body.maxSlippageBps : undefined,
            rebalanceCadenceHours: typeof body.rebalanceCadenceHours === "number" ? body.rebalanceCadenceHours : undefined,
            minApyBps: typeof body.minApyBps === "number" ? body.minApyBps : undefined,
            minSpreadOverTbillBps: typeof body.minSpreadOverTbillBps === "number" ? body.minSpreadOverTbillBps : undefined,
            requireManualAboveUsd: typeof body.requireManualAboveUsd === "number" ? body.requireManualAboveUsd : undefined,
            pauseOnRiskEvent: typeof body.pauseOnRiskEvent === "boolean" ? body.pauseOnRiskEvent : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
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
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const vault = await automation.createFundingIntent({
            ownerEoa,
            amountUsd: typeof body.amountUsd === "number" ? body.amountUsd : null,
            source: typeof body.source === "string" ? body.source : null,
          });

          return new Response(JSON.stringify({ success: true, vault }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/vault/ownership-ack" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const state = await automation.acknowledgeVaultOwnership({
            ownerEoa,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
          });

          return new Response(JSON.stringify({ success: true, state }), { headers: corsHeaders });
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
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "requestedBy or ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const res = await handlers.handleLogDecision(body);
          return new Response(res.content[0].text, { headers: corsHeaders });
        }

        const benchmarkMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)\/benchmark$/);
        if (benchmarkMatch && request.method === "PATCH") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "requestedBy or ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const res = await handlers.handleUpdateDecisionBenchmark({
            decisionId: decodeURIComponent(benchmarkMatch[1]),
            benchmarkStatus: typeof body.benchmarkStatus === "string" ? body.benchmarkStatus : undefined,
            txHash: typeof body.txHash === "string" ? body.txHash : undefined,
            onchainDecisionId: typeof body.onchainDecisionId === "string" ? body.onchainDecisionId : undefined,
            requestedBy: typeof body.requestedBy === "string" ? body.requestedBy : ownerEoa,
            dataSnapshotHash: typeof body.dataSnapshotHash === "string" ? body.dataSnapshotHash : undefined,
            agentAddress: typeof body.agentAddress === "string" ? body.agentAddress : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
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

        if (url.pathname === "/api/automation/state" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const state = await automation.getAutomationState(ownerEoa);
          return new Response(JSON.stringify(state), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/accounts" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const account = await automation.upsertAccount({
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            chainId: typeof body.chainId === "number" ? body.chainId : undefined,
            accountProvider: typeof body.accountProvider === "string" ? body.accountProvider : undefined,
            accountKind: typeof body.accountKind === "string" ? body.accountKind : undefined,
            deploymentStatus: typeof body.deploymentStatus === "string" ? body.deploymentStatus : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
          });

          return new Response(JSON.stringify({ success: true, account }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/policies" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const policy = await automation.upsertPolicy({
            policyId: String(body.policyId),
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            chainId: typeof body.chainId === "number" ? body.chainId : undefined,
            policyVersion: String(body.policyVersion),
            domain: body.domain as "benchmark" | "execution",
            status: typeof body.status === "string" ? body.status : undefined,
            allowedContracts: Array.isArray(body.allowedContracts) ? body.allowedContracts as string[] : undefined,
            allowedSelectors: Array.isArray(body.allowedSelectors) ? body.allowedSelectors as string[] : undefined,
            allowedAssets: Array.isArray(body.allowedAssets) ? body.allowedAssets as string[] : undefined,
            allowedProtocols: Array.isArray(body.allowedProtocols) ? body.allowedProtocols as string[] : undefined,
            spendToken: typeof body.spendToken === "string" ? body.spendToken : undefined,
            spendLimitPerUse: typeof body.spendLimitPerUse === "string" ? body.spendLimitPerUse : undefined,
            spendLimitDaily: typeof body.spendLimitDaily === "string" ? body.spendLimitDaily : undefined,
            spendLimitTotal: typeof body.spendLimitTotal === "string" ? body.spendLimitTotal : undefined,
            usageLimit: typeof body.usageLimit === "number" ? body.usageLimit : undefined,
            validAfter: typeof body.validAfter === "string" ? body.validAfter : undefined,
            validUntil: typeof body.validUntil === "string" ? body.validUntil : undefined,
            humanSummary: typeof body.humanSummary === "string" ? body.humanSummary : undefined,
            rawPolicy: typeof body.rawPolicy === "object" && body.rawPolicy ? body.rawPolicy as Record<string, unknown> : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
          });

          return new Response(JSON.stringify({ success: true, policy }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/sessions" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const session = await automation.upsertSession({
            sessionId: String(body.sessionId),
            policyId: String(body.policyId),
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            agentSessionSigner: String(body.agentSessionSigner),
            chainId: typeof body.chainId === "number" ? body.chainId : undefined,
            sessionStatus: typeof body.sessionStatus === "string" ? body.sessionStatus : undefined,
            grantTxHash: typeof body.grantTxHash === "string" ? body.grantTxHash : undefined,
            revokeTxHash: typeof body.revokeTxHash === "string" ? body.revokeTxHash : undefined,
            permissionId: typeof body.permissionId === "string" ? body.permissionId : undefined,
            sessionDetails: body.sessionDetails,
            validAfter: typeof body.validAfter === "string" ? body.validAfter : undefined,
            validUntil: typeof body.validUntil === "string" ? body.validUntil : undefined,
            revokedAt: typeof body.revokedAt === "string" ? body.revokedAt : undefined,
            providerSessionRef: typeof body.providerSessionRef === "string" ? body.providerSessionRef : undefined,
            providerPermissionRef: typeof body.providerPermissionRef === "string" ? body.providerPermissionRef : undefined,
            consentMessage: typeof body.consentMessage === "string" ? body.consentMessage : undefined,
            consentSignature: typeof body.consentSignature === "string" ? body.consentSignature : undefined,
            consentDigest: typeof body.consentDigest === "string" ? body.consentDigest : undefined,
            consentVerifiedAt: typeof body.consentVerifiedAt === "string" ? body.consentVerifiedAt : undefined,
            turnkeySignerRef: typeof body.turnkeySignerRef === "string" ? body.turnkeySignerRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
          });

          return new Response(JSON.stringify({ success: true, session }), { headers: corsHeaders });
        }

        const activateSessionMatch = url.pathname.match(/^\/api\/automation\/sessions\/([^/]+)\/activate$/);
        if (activateSessionMatch && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const session = await automation.upsertSession({
            sessionId: decodeURIComponent(activateSessionMatch[1]),
            policyId: String(body.policyId),
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            agentSessionSigner: String(body.agentSessionSigner),
            chainId: typeof body.chainId === "number" ? body.chainId : undefined,
            sessionStatus: "active",
            grantTxHash: typeof body.grantTxHash === "string" ? body.grantTxHash : undefined,
            permissionId: typeof body.permissionId === "string" ? body.permissionId : undefined,
            sessionDetails: body.sessionDetails,
            validAfter: typeof body.validAfter === "string" ? body.validAfter : undefined,
            validUntil: typeof body.validUntil === "string" ? body.validUntil : undefined,
            providerSessionRef: typeof body.providerSessionRef === "string" ? body.providerSessionRef : undefined,
            providerPermissionRef: typeof body.providerPermissionRef === "string" ? body.providerPermissionRef : undefined,
            consentMessage: typeof body.consentMessage === "string" ? body.consentMessage : undefined,
            consentSignature: typeof body.consentSignature === "string" ? body.consentSignature : undefined,
            consentDigest: typeof body.consentDigest === "string" ? body.consentDigest : undefined,
            consentVerifiedAt: typeof body.consentVerifiedAt === "string" ? body.consentVerifiedAt : undefined,
            turnkeySignerRef: typeof body.turnkeySignerRef === "string" ? body.turnkeySignerRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
          });

          return new Response(JSON.stringify({ success: true, session }), { headers: corsHeaders });
        }

        const revokeSessionMatch = url.pathname.match(/^\/api\/automation\/sessions\/([^/]+)\/revoke$/);
        if (revokeSessionMatch && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const session = await automation.upsertSession({
            sessionId: decodeURIComponent(revokeSessionMatch[1]),
            policyId: String(body.policyId),
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            agentSessionSigner: String(body.agentSessionSigner),
            chainId: typeof body.chainId === "number" ? body.chainId : undefined,
            sessionStatus: typeof body.sessionStatus === "string" ? body.sessionStatus : "revoked",
            grantTxHash: typeof body.grantTxHash === "string" ? body.grantTxHash : undefined,
            revokeTxHash: typeof body.revokeTxHash === "string" ? body.revokeTxHash : undefined,
            permissionId: typeof body.permissionId === "string" ? body.permissionId : undefined,
            sessionDetails: body.sessionDetails,
            validAfter: typeof body.validAfter === "string" ? body.validAfter : undefined,
            validUntil: typeof body.validUntil === "string" ? body.validUntil : undefined,
            revokedAt: typeof body.revokedAt === "string" ? body.revokedAt : new Date().toISOString(),
            providerSessionRef: typeof body.providerSessionRef === "string" ? body.providerSessionRef : undefined,
            providerPermissionRef: typeof body.providerPermissionRef === "string" ? body.providerPermissionRef : undefined,
            consentMessage: typeof body.consentMessage === "string" ? body.consentMessage : undefined,
            consentSignature: typeof body.consentSignature === "string" ? body.consentSignature : undefined,
            consentDigest: typeof body.consentDigest === "string" ? body.consentDigest : undefined,
            consentVerifiedAt: typeof body.consentVerifiedAt === "string" ? body.consentVerifiedAt : undefined,
            turnkeySignerRef: typeof body.turnkeySignerRef === "string" ? body.turnkeySignerRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
          });

          return new Response(JSON.stringify({ success: true, session }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/jobs" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const job = await automation.upsertAutomationJob({
            jobId: String(body.jobId),
            sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            executionDomain: body.executionDomain as "benchmark" | "execution",
            jobType: String(body.jobType),
            targetContract: typeof body.targetContract === "string" ? body.targetContract : undefined,
            targetSelector: typeof body.targetSelector === "string" ? body.targetSelector : undefined,
            payload: typeof body.payload === "object" && body.payload ? body.payload as Record<string, unknown> : undefined,
            status: typeof body.status === "string" ? body.status : undefined,
            txHash: typeof body.txHash === "string" ? body.txHash : undefined,
            confirmedAt: typeof body.confirmedAt === "string" ? body.confirmedAt : undefined,
            failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
            providerJobRef: typeof body.providerJobRef === "string" ? body.providerJobRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
          });

          return new Response(JSON.stringify({ success: true, job }), { headers: corsHeaders });
        }

        const automationJobMatch = url.pathname.match(/^\/api\/automation\/jobs\/([^/]+)$/);
        if (automationJobMatch && request.method === "PATCH") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const job = await automation.upsertAutomationJob({
            jobId: decodeURIComponent(automationJobMatch[1]),
            sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
            ownerEoa,
            userSmartAccount: typeof body.userSmartAccount === "string" ? body.userSmartAccount : undefined,
            executionDomain: body.executionDomain as "benchmark" | "execution",
            jobType: String(body.jobType),
            targetContract: typeof body.targetContract === "string" ? body.targetContract : undefined,
            targetSelector: typeof body.targetSelector === "string" ? body.targetSelector : undefined,
            payload: typeof body.payload === "object" && body.payload ? body.payload as Record<string, unknown> : undefined,
            status: typeof body.status === "string" ? body.status : undefined,
            txHash: typeof body.txHash === "string" ? body.txHash : undefined,
            confirmedAt: typeof body.confirmedAt === "string" ? body.confirmedAt : undefined,
            failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
            providerJobRef: typeof body.providerJobRef === "string" ? body.providerJobRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
          });

          return new Response(JSON.stringify({ success: true, job }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/benchmark-jobs" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const benchmarkJob = await automation.upsertBenchmarkJob({
            benchmarkJobId: String(body.benchmarkJobId),
            decisionId: String(body.decisionId),
            ownerEoa,
            agentSmartWallet: typeof body.agentSmartWallet === "string" ? body.agentSmartWallet : undefined,
            sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
            status: typeof body.status === "string" ? body.status : undefined,
            txHash: typeof body.txHash === "string" ? body.txHash : undefined,
            onchainDecisionId: typeof body.onchainDecisionId === "string" ? body.onchainDecisionId : undefined,
            confirmedAt: typeof body.confirmedAt === "string" ? body.confirmedAt : undefined,
            dataSnapshotHash: typeof body.dataSnapshotHash === "string" ? body.dataSnapshotHash : undefined,
            payload: typeof body.payload === "object" && body.payload ? body.payload as Record<string, unknown> : undefined,
            failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
            providerJobRef: typeof body.providerJobRef === "string" ? body.providerJobRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
          });

          return new Response(JSON.stringify({ success: true, benchmarkJob }), { headers: corsHeaders });
        }

        const benchmarkJobMatch = url.pathname.match(/^\/api\/benchmark-jobs\/([^/]+)$/);
        if (benchmarkJobMatch && request.method === "PATCH") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const benchmarkJob = await automation.upsertBenchmarkJob({
            benchmarkJobId: decodeURIComponent(benchmarkJobMatch[1]),
            decisionId: String(body.decisionId),
            ownerEoa,
            agentSmartWallet: typeof body.agentSmartWallet === "string" ? body.agentSmartWallet : undefined,
            sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
            status: typeof body.status === "string" ? body.status : undefined,
            txHash: typeof body.txHash === "string" ? body.txHash : undefined,
            onchainDecisionId: typeof body.onchainDecisionId === "string" ? body.onchainDecisionId : undefined,
            confirmedAt: typeof body.confirmedAt === "string" ? body.confirmedAt : undefined,
            dataSnapshotHash: typeof body.dataSnapshotHash === "string" ? body.dataSnapshotHash : undefined,
            payload: typeof body.payload === "object" && body.payload ? body.payload as Record<string, unknown> : undefined,
            failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
            providerJobRef: typeof body.providerJobRef === "string" ? body.providerJobRef : undefined,
            userId: typeof body.userId === "string" ? body.userId : undefined,
            vaultId: typeof body.vaultId === "string" ? body.vaultId : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
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
