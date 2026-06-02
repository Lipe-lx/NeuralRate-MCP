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
  createAutomationGrantChallenge,
  type ExpectedPublishedPolicy,
  issueAutomationGrant,
  preparePolicyPublish,
  submitPolicyPublish,
  preparePolicyRevoke,
  submitPolicyRevoke,
  prepareVaultRuntimeEnable,
  submitVaultRuntimeEnable,
  prepareVaultRuntimeDisable,
  submitVaultRuntimeDisable,
  queueBenchmarkThroughExecutor,
  queueStrategyThroughExecutor,
  resolveAutomationAccessFromOwner,
  resolveAutomationAccessFromSessionToken,
  revokeAutomationGrant,
  updateAgentPolicyFromScopedAccess,
} from "./automationControl";
import {
  McpToolHandlers,
  bootstrapUserVaultSchema,
  executeStrategySchema,
  getDecisionLineageSchema,
  getDecisionsSchema,
  getUserStateSchema,
  yieldScanSchema,
  issueAutomationGrantSchema,
  listJobsSchema,
  tbillSpreadSchema,
  nansenContextSchema,
  queueBenchmarkSchema,
  revokeAutomationGrantSchema,
  riskAssessSchema,
  optimalAllocationSchema,
  logDecisionSchema,
  prepareAutomationGrantSchema,
  preparePolicyPublishSchema,
  preparePolicyRevokeSchema,
  prepareVaultRuntimeDisableSchema,
  prepareVaultRuntimeEnableSchema,
  submitAutomationGrantSchema,
  submitPolicyPublishSchema,
  submitPolicyRevokeSchema,
  submitVaultRuntimeDisableSchema,
  submitVaultRuntimeEnableSchema,
  updateAgentPolicySchema,
} from "./mcp/tools";
import { withOnchainPolicyState } from "./onchainState";

export interface Env {
  CACHE_KV: KVNamespace;
  DECISIONS_DB: D1Database;
  MCP_OBJECT: DurableObjectNamespace;
  MCP_READONLY_OBJECT: DurableObjectNamespace;
  MCP_CONFIG_OBJECT: DurableObjectNamespace;
  MCP_BENCHMARK_OBJECT: DurableObjectNamespace;
  MCP_EXECUTION_OBJECT: DurableObjectNamespace;
  FRED_API_KEY: string;
  NANSEN_API_KEY: string;
  NEURALRATE_BENCHMARK_CONTRACT: string;
  NEURALRATE_POLICY_REGISTRY_CONTRACT?: string;
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?: string;
  NEURALRATE_EXECUTION_GUARD_CONTRACT?: string;
  NEURALRATE_VAULT_MODULE_ADDRESS?: string;
  NEURALRATE_SAFE_4337_MODULE_ADDRESS?: string;
  NEURALRATE_SAFE_7579_ADAPTER_ADDRESS?: string;
  NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS?: string;
  NEURALRATE_DELEGATE_VALIDATOR_ADDRESS?: string;
  NEURALRATE_4337_ENTRYPOINT_ADDRESS?: string;
  NEURALRATE_ERC7484_REGISTRY_ADDRESS?: string;
  MANTLE_SEPOLIA_RPC_URL?: string;
  NEURALRATE_CHAIN_ID?: string;
  NEURALRATE_ENV_PROFILE?: string;
  NEURALRATE_INTERNAL_API_TOKEN?: string;
  INTERNAL_API_TOKEN?: string;
  EXECUTOR_BASE_URL?: string;
}

const getInternalApiToken = (env: Env) =>
  env.NEURALRATE_INTERNAL_API_TOKEN?.trim() || env.INTERNAL_API_TOKEN?.trim() || null;

const MCP_CANONICAL_ROUTE = "/mcp";
const MCP_SSE_ALIAS_ROUTE = "/sse";
const MCP_SCOPED_ROUTE = "/mcp/scoped";
const MCP_SCOPED_SSE_ALIAS_ROUTE = "/sse/scoped";
const MCP_SCOPED_STATE_ROUTE = "/mcp/scoped/state";
const MCP_SCOPED_STATE_SSE_ALIAS_ROUTE = "/sse/scoped/state";
const MCP_SCOPED_CONFIG_ROUTE = "/mcp/scoped/config";
const MCP_SCOPED_CONFIG_SSE_ALIAS_ROUTE = "/sse/scoped/config";
const MCP_SCOPED_BENCHMARK_ROUTE = "/mcp/scoped/benchmark";
const MCP_SCOPED_BENCHMARK_SSE_ALIAS_ROUTE = "/sse/scoped/benchmark";
const MCP_SCOPED_EXECUTION_ROUTE = "/mcp/scoped/execution";
const MCP_SCOPED_EXECUTION_SSE_ALIAS_ROUTE = "/sse/scoped/execution";

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

const getHeaderAuthEnvelope = (request: Request) => {
  const ownerEoa = request.headers.get("x-neuralrate-auth-owner-eoa")?.trim();
  const nonce = request.headers.get("x-neuralrate-auth-nonce")?.trim();
  const issuedAt = request.headers.get("x-neuralrate-auth-issued-at")?.trim();
  const expiresAt = request.headers.get("x-neuralrate-auth-expires-at")?.trim();
  const signature = request.headers.get("x-neuralrate-auth-signature")?.trim();

  if (!ownerEoa || !nonce || !issuedAt || !expiresAt || !signature) {
    return null;
  }

  return {
    ownerEoa,
    nonce,
    issuedAt,
    expiresAt,
    signature,
  } satisfies MutationAuthEnvelope;
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
  if (isInternalMutationRequest(request, getInternalApiToken(env))) {
    return { mode: "internal" as const, ownerEoa: expectedOwner.toLowerCase() };
  }

  const auth = getAuthEnvelope(body);
  if (!auth) {
    throw new Error("Missing signed mutation auth envelope.");
  }

  const verified = await verifyMutationAuthEnvelope(env.DECISIONS_DB, auth, expectedOwner);
  return { mode: "signed" as const, ownerEoa: verified.ownerEoa };
};

const assertReadAuthorized = async (
  request: Request,
  env: Env,
  expectedOwner: string
) => {
  if (isInternalMutationRequest(request, getInternalApiToken(env))) {
    return { mode: "internal" as const, ownerEoa: expectedOwner.toLowerCase() };
  }

  const auth = getHeaderAuthEnvelope(request);
  if (!auth) {
    throw new Error("Missing signed read auth headers.");
  }

  const verified = await verifyMutationAuthEnvelope(env.DECISIONS_DB, auth, expectedOwner);
  return { mode: "signed" as const, ownerEoa: verified.ownerEoa };
};

const resolveAutomationAccess = async (
  request: Request,
  env: Env,
  automation: AutomationStore,
  body: Record<string, unknown>,
  requiredDomain: "state" | "config" | "benchmark" | "execution"
) => {
  if (isInternalMutationRequest(request, getInternalApiToken(env))) {
    const ownerEoa = resolveMutationOwner(body);
    if (!ownerEoa) {
      throw new Error("ownerEoa is required for internal automation access.");
    }
    return resolveAutomationAccessFromOwner(automation, ownerEoa, requiredDomain);
  }

  const sessionToken = request.headers.get("x-neuralrate-session-token")?.trim();
  if (sessionToken) {
    return resolveAutomationAccessFromSessionToken(automation, sessionToken, requiredDomain);
  }

  const ownerEoa = resolveMutationOwner(body);
  if (!ownerEoa) {
    throw new Error("ownerEoa or x-neuralrate-session-token header is required.");
  }

  await assertMutationAuthorized(request, env, body, ownerEoa);
  return resolveAutomationAccessFromOwner(automation, ownerEoa, requiredDomain);
};

const resolveOwnerControlAccess = async (
  automation: AutomationStore,
  ownerEoa: string
) => {
  const state = await automation.getAutomationState(ownerEoa);
  if (!state.userId || !state.vault?.vault_id || !state.vault?.vault_address) {
    throw new Error("Bootstrap the dedicated vault before running control-plane actions.");
  }

  return {
    ownerEoa: state.ownerEoa,
    userId: String(state.userId),
    vaultId: String(state.vault.vault_id),
    vaultAddress: String(state.vault.vault_address),
    agentSubject: "owner-control",
    policyVersion: String(state.config?.policy_version ?? "vault-v1"),
    sessionId: "owner-control",
    grantId: "owner-control",
    allowedDomains: ["state", "config", "benchmark", "execution"],
    grantExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    authMode: "signed" as const,
  };
};

const buildAuditSummary = (state: Record<string, unknown>) => {
  const events: Array<{ type: string; status: string; at: string | null; detail: string }> = [];
  const onchainPolicy = (state.onchainPolicy ?? null) as Record<string, unknown> | null;
  const activeGrant = (state.activeGrant ?? null) as Record<string, unknown> | null;
  const activeSession = (state.activeSession ?? null) as Record<string, unknown> | null;
  const benchmarkJobs = Array.isArray(state.benchmarkJobs) ? (state.benchmarkJobs as Array<Record<string, unknown>>) : [];
  const automationJobs = Array.isArray(state.automationJobs) ? (state.automationJobs as Array<Record<string, unknown>>) : [];

  events.push({
    type: "policy_published",
    status: onchainPolicy ? "present" : "missing",
    at: typeof onchainPolicy?.publishedAt === "string" ? onchainPolicy.publishedAt : null,
    detail: onchainPolicy ? String(onchainPolicy.policyId ?? "policy") : "No on-chain policy found for this owner.",
  });
  events.push({
    type: "grant_issued",
    status: activeGrant?.status === "active" ? "active" : activeGrant ? "inactive" : "missing",
    at: typeof activeGrant?.issued_at === "string" ? activeGrant.issued_at : null,
    detail: activeGrant ? String(activeGrant.grant_id ?? "grant") : "No active automation grant.",
  });
  events.push({
    type: "session_created",
    status: activeSession?.session_status ? String(activeSession.session_status) : "missing",
    at: typeof activeSession?.issued_at === "string" ? activeSession.issued_at : null,
    detail: activeSession ? String(activeSession.session_id ?? "session") : "No MCP mutation session found.",
  });

  const blockedJobs = automationJobs.filter((job) => typeof job.failure_reason === "string" && job.failure_reason.length > 0);
  const executedJobs = automationJobs.filter((job) => typeof job.tx_hash === "string" && job.tx_hash.length > 0);
  const anchoredReceipts = benchmarkJobs.filter((job) => typeof job.tx_hash === "string" && job.tx_hash.length > 0);

  events.push({
    type: "strategy_blocked",
    status: blockedJobs.length > 0 ? "present" : "none",
    at: typeof blockedJobs[0]?.updated_at === "string" ? String(blockedJobs[0].updated_at) : null,
    detail: `${blockedJobs.length} blocked automation jobs`,
  });
  events.push({
    type: "strategy_executed",
    status: executedJobs.length > 0 ? "present" : "none",
    at: typeof executedJobs[0]?.confirmed_at === "string" ? String(executedJobs[0].confirmed_at) : null,
    detail: `${executedJobs.length} executed automation jobs`,
  });
  events.push({
    type: "receipt_created",
    status: anchoredReceipts.length > 0 ? "present" : "none",
    at: typeof anchoredReceipts[0]?.updated_at === "string" ? String(anchoredReceipts[0].updated_at) : null,
    detail: `${anchoredReceipts.length} benchmark receipts with tx hash`,
  });

  return { events };
};

type ScopedMutationDomain = "config" | "benchmark" | "execution";
type ScopedCatalogDomain = "state" | ScopedMutationDomain;
type ScopedCatalogBinding = {
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  sessionId: string;
  grantId: string;
  allowedDomains: string[];
  grantExpiresAt: string;
  authMode: "session" | "signed";
};

const scopedMcpSessionKey = (domain: ScopedCatalogDomain, mcpSessionId: string) =>
  `mcp-scoped-session:${domain}:${mcpSessionId}`;

const bindScopedMcpSession = async (
  env: Env,
  domain: ScopedCatalogDomain,
  mcpSessionId: string,
  access: ScopedCatalogBinding
) => {
  const ttlMs = Math.max(Date.parse(access.grantExpiresAt) - Date.now(), 60_000);
  const expirationTtl = Math.max(60, Math.ceil(ttlMs / 1000));
  await env.CACHE_KV.put(
    scopedMcpSessionKey(domain, mcpSessionId),
    JSON.stringify(access),
    { expirationTtl }
  );
};

const resolveScopedMcpSession = async (
  env: Env,
  domain: ScopedCatalogDomain,
  mcpSessionId: string
) => {
  const raw = await env.CACHE_KV.get(scopedMcpSessionKey(domain, mcpSessionId));
  if (!raw) {
    throw new Error("Unknown scoped MCP session. Re-initialize the scoped catalog with x-neuralrate-session-token.");
  }

  const parsed = JSON.parse(raw) as ScopedCatalogBinding;
  if (Date.parse(parsed.grantExpiresAt) < Date.now()) {
    throw new Error("Scoped MCP session has expired.");
  }

  if (!parsed.allowedDomains.includes(domain)) {
    throw new Error(`Scoped MCP session is not authorized for the ${domain} domain.`);
  }

  return parsed;
};

const createServices = (env: Env) => {
  const defillama = new DefiLlamaService(env.CACHE_KV);
  const fred = new FredService(env.CACHE_KV, env.FRED_API_KEY);
  const nansen = new NansenService(env.CACHE_KV, env.NANSEN_API_KEY);
  const handlers = new McpToolHandlers(defillama, fred, nansen, env.DECISIONS_DB);
  const automation = new AutomationStore(env.DECISIONS_DB);
  return { defillama, fred, nansen, handlers, automation };
};

const registerReadonlyCatalog = (
  server: McpServer,
  handlers: McpToolHandlers,
  automation: AutomationStore,
  env: Env
) => {
  server.tool(
    "yield_scan",
    "Scans Mantle DeFi pools for current APY and TVL via DefiLlama",
    yieldScanSchema,
    handlers.handleYieldScan.bind(handlers)
  );

  server.tool(
    "tbill_spread",
    "Calculates the spread (in bps) between a given DeFi pool APY and the real-time US 3-Month T-Bill rate",
    tbillSpreadSchema,
    handlers.handleTbillSpread.bind(handlers)
  );

  server.tool(
    "nansen_context",
    "Fetches Smart Money inflows/outflows for a specific token via Nansen API",
    nansenContextSchema,
    handlers.handleNansenContext.bind(handlers)
  );

  server.tool(
    "risk_assess",
    "Performs a deterministic risk assessment returning a score (0-100) and classification",
    riskAssessSchema,
    handlers.handleRiskAssess.bind(handlers)
  );

  server.tool(
    "optimal_allocation",
    "Calculates an optimal allocation of funds across Mantle pools based on risk profile",
    optimalAllocationSchema,
    handlers.handleOptimalAllocation.bind(handlers)
  );
};

const getScopedCatalogRequest = (request: Request) => {
  return {
    sessionToken: request.headers.get("x-neuralrate-session-token")?.trim() ?? null,
    mcpSessionId: request.headers.get("mcp-session-id")?.trim() ?? null,
  };
};

const requireScopedCatalogAccess = async (
  request: Request,
  env: Env,
  requiredDomain: ScopedCatalogDomain
) => {
  const { sessionToken, mcpSessionId } = getScopedCatalogRequest(request);
  if (mcpSessionId) {
    return resolveScopedMcpSession(env, requiredDomain, mcpSessionId);
  }

  if (!sessionToken) {
    throw new Error("x-neuralrate-session-token header is required to initialize a scoped MCP catalog.");
  }

  const automation = new AutomationStore(env.DECISIONS_DB);
  return resolveAutomationAccessFromSessionToken(automation, sessionToken, requiredDomain);
};

const resolveScopedCatalogRoute = (url: URL): { route: string; domain: ScopedCatalogDomain } | null => {
  if (
    url.pathname.startsWith(MCP_SCOPED_STATE_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_STATE_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_STATE_ROUTE, domain: "state" };
  }

  if (
    url.pathname.startsWith(MCP_SCOPED_CONFIG_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_CONFIG_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_CONFIG_ROUTE, domain: "config" };
  }

  if (
    url.pathname.startsWith(MCP_SCOPED_BENCHMARK_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_BENCHMARK_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_BENCHMARK_ROUTE, domain: "benchmark" };
  }

  if (
    url.pathname.startsWith(MCP_SCOPED_EXECUTION_ROUTE) ||
    url.pathname.startsWith(MCP_SCOPED_EXECUTION_SSE_ALIAS_ROUTE)
  ) {
    return { route: MCP_SCOPED_EXECUTION_ROUTE, domain: "execution" };
  }

  if (url.pathname.startsWith(MCP_SCOPED_ROUTE) || url.pathname.startsWith(MCP_SCOPED_SSE_ALIAS_ROUTE)) {
    const domain = url.searchParams.get("domain")?.trim() ?? null;
    if (domain === "state") {
      return { route: MCP_SCOPED_STATE_ROUTE, domain };
    }
    if (domain === "config") {
      return { route: MCP_SCOPED_CONFIG_ROUTE, domain };
    }
    if (domain === "benchmark") {
      return { route: MCP_SCOPED_BENCHMARK_ROUTE, domain };
    }
    if (domain === "execution") {
      return { route: MCP_SCOPED_EXECUTION_ROUTE, domain };
    }
  }

  return null;
};

export class NeuralRateMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp",
    version: "1.0.0"
  });

  async init() {
    const { handlers, automation } = createServices(this.env);
    registerReadonlyCatalog(this.server, handlers, automation, this.env);
  }
}

export class NeuralRateReadonlyMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp-readonly",
    version: "1.0.0"
  });

  async init() {
    const { handlers, automation } = createServices(this.env);
    registerReadonlyCatalog(this.server, handlers, automation, this.env);
  }
}

export class NeuralRateStateMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp-state",
    version: "1.0.0"
  });

  async init() {
    const { handlers, automation } = createServices(this.env);
    const scoped = await resolveScopedMcpSession(this.env, "state", this.getSessionId());

    this.server.tool(
      "get_user_state",
      "Fetches the scoped user, vault, grant, session and job state",
      getUserStateSchema,
      async () => {
        const state = await withOnchainPolicyState(await automation.getAutomationState(scoped.ownerEoa), this.env);
        return {
          content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
          structuredContent: state,
        };
      }
    );

    this.server.tool(
      "list_jobs",
      "Lists scoped benchmark and execution jobs for a user vault",
      listJobsSchema,
      async () => {
        const [automationJobs, benchmarkJobs] = await Promise.all([
          automation.listAutomationJobs(scoped.ownerEoa),
          automation.listBenchmarkJobs(scoped.ownerEoa),
        ]);
        const structured = { automationJobs, benchmarkJobs };
        return {
          content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        };
      }
    );

    this.server.tool(
      "get_decisions",
      "Fetches the scoped decision history for the bound owner",
      getDecisionsSchema,
      async ({ limit }) => {
        const result = await handlers.handleGetDecisions({
          limit,
          ownerEoa: scoped.ownerEoa,
        });
        return result;
      }
    );

    this.server.tool(
      "get_benchmark_history",
      "Fetches scoped benchmark decision history",
      getDecisionsSchema,
      async ({ limit }) => {
        const decisions = await automation.listBenchmarkHistory(scoped.ownerEoa, limit ?? 50);
        const structured = { decisions };
        return {
          content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        };
      }
    );

    this.server.tool(
      "get_decision_lineage",
      "Returns snapshot and rationale lineage for one scoped decision",
      getDecisionLineageSchema,
      async ({ decisionId }) => {
        const lineage = await this.env.DECISIONS_DB
          .prepare("SELECT decision_id, data_snapshot_hash, allocation_json, applied_constraints_json, rationale_json, created_at FROM decisions WHERE decision_id = ? AND (requested_by = ? OR agent_address = ?) LIMIT 1")
          .bind(decisionId, scoped.ownerEoa.toLowerCase(), scoped.ownerEoa.toLowerCase())
          .first<Record<string, unknown>>();

        if (!lineage) {
          throw new Error("Decision not found.");
        }

        return {
          content: [{ type: "text", text: JSON.stringify(lineage, null, 2) }],
          structuredContent: lineage,
        };
      }
    );

    this.server.tool(
      "get_audit_summary",
      "Returns a compact audit summary for the bound owner",
      {},
      async () => {
        const state = await withOnchainPolicyState(await automation.getAutomationState(scoped.ownerEoa), this.env);
        const summary = buildAuditSummary(state as unknown as Record<string, unknown>);
        return {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          structuredContent: summary,
        };
      }
    );
  }
}

export class NeuralRateConfigMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp-config",
    version: "1.0.0"
  });

  async init() {
    const { handlers, automation } = createServices(this.env);
    registerReadonlyCatalog(this.server, handlers, automation, this.env);
    const scoped = await resolveScopedMcpSession(this.env, "config", this.getSessionId());

    this.server.tool(
      "update_agent_policy",
      "Updates the scoped NeuralRate agent policy for a user vault",
      updateAgentPolicySchema,
      async (args) => {
        const config = await updateAgentPolicyFromScopedAccess(automation, scoped, args as unknown as Record<string, unknown>);
        const state = await withOnchainPolicyState(await automation.getAutomationState(scoped.ownerEoa), this.env);
        return {
          content: [{ type: "text", text: JSON.stringify({
            config,
            policySyncStatus: state.policySyncStatus,
            draftPolicy: state.draftPolicy,
            activeOnchainPolicy: state.activeOnchainPolicy,
          }, null, 2) }],
          structuredContent: {
            config,
            policySyncStatus: state.policySyncStatus,
            draftPolicy: state.draftPolicy,
            activeOnchainPolicy: state.activeOnchainPolicy,
          } as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "prepare_policy_publish",
      "Builds the canonical on-chain publishPolicy transaction for the bound owner",
      preparePolicyPublishSchema,
      async () => {
        const result = await preparePolicyPublish(automation, this.env, scoped);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "submit_policy_publish",
      "Verifies the active on-chain policy and returns the synchronized state",
      submitPolicyPublishSchema,
      async ({ txHash, expectedPolicy }) => {
        const result = await submitPolicyPublish(automation, this.env, scoped, {
          txHash,
          expectedPolicy,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "prepare_policy_revoke",
      "Builds the canonical on-chain revokeActivePolicy transaction for the bound owner",
      preparePolicyRevokeSchema,
      async () => {
        const result = await preparePolicyRevoke(automation, this.env, scoped);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "submit_policy_revoke",
      "Verifies that the active on-chain policy has been revoked",
      submitPolicyRevokeSchema,
      async ({ txHash }) => {
        const result = await submitPolicyRevoke(automation, this.env, scoped, txHash);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "prepare_vault_runtime_enable",
      "Returns the ordered runtime actions needed to enable autonomous execution for the vault",
      prepareVaultRuntimeEnableSchema,
      async () => {
        const result = await prepareVaultRuntimeEnable(automation, this.env, scoped);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "submit_vault_runtime_enable",
      "Verifies the vault runtime is active on-chain after owner-approved transactions",
      submitVaultRuntimeEnableSchema,
      async ({ txHashes }) => {
        const result = await submitVaultRuntimeEnable(automation, this.env, scoped, txHashes);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "prepare_vault_runtime_disable",
      "Returns the ordered runtime actions needed to disable autonomous execution for the vault",
      prepareVaultRuntimeDisableSchema,
      async () => {
        const result = await prepareVaultRuntimeDisable(automation, this.env, scoped);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "submit_vault_runtime_disable",
      "Verifies the vault runtime state after disable transactions",
      submitVaultRuntimeDisableSchema,
      async ({ txHashes }) => {
        const result = await submitVaultRuntimeDisable(automation, this.env, scoped, txHashes);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "prepare_automation_grant",
      "Creates the canonical automation grant challenge to be signed by the owner",
      prepareAutomationGrantSchema,
      async (args) => {
        const challenge = await createAutomationGrantChallenge(automation, {
          ownerEoa: scoped.ownerEoa,
          agentSubject: args.agentSubject,
          allowedDomains: args.allowedDomains,
          policyVersion: args.policyVersion,
          expiresAt: args.expiresAt,
        });

        const result = { success: true, challenge };
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "submit_automation_grant",
      "Finalizes the automation grant after owner signature",
      submitAutomationGrantSchema,
      async (args) => {
        const result = await issueAutomationGrant(automation, this.env, {
          ownerEoa: scoped.ownerEoa,
          agentSubject: args.agentSubject,
          allowedDomains: args.allowedDomains,
          policyVersion: args.policyVersion,
          issuedAt: args.issuedAt,
          expiresAt: args.expiresAt,
          nonce: args.nonce,
          signature: args.signature,
          issuedVia: args.issuedVia ?? "mcp",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );

    this.server.tool(
      "revoke_automation_grant",
      "Revokes the active automation grant bound to the owner",
      revokeAutomationGrantSchema,
      async ({ grantId }) => {
        const resolvedGrantId = grantId || scoped.grantId;
        const result = await revokeAutomationGrant(automation, resolvedGrantId);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );
  }
}

export class NeuralRateBenchmarkMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp-benchmark",
    version: "1.0.0"
  });

  async init() {
    const { handlers, automation } = createServices(this.env);
    registerReadonlyCatalog(this.server, handlers, automation, this.env);
    const scoped = await resolveScopedMcpSession(this.env, "benchmark", this.getSessionId());

    this.server.tool(
      "queue_benchmark",
      "Queues a scoped benchmark job through the internal executor",
      queueBenchmarkSchema,
      async (args) => {
        const result = await queueBenchmarkThroughExecutor(this.env, scoped, {
          decisionId: args.decisionId,
          dataSnapshotHash: args.dataSnapshotHash,
          payload: args.payload as Record<string, unknown> | undefined,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
    );
  }
}

export class NeuralRateExecutionMcpAgent extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "neuralrate-mcp-execution",
    version: "1.0.0"
  });

  async init() {
    const { handlers, automation } = createServices(this.env);
    registerReadonlyCatalog(this.server, handlers, automation, this.env);
    const scoped = await resolveScopedMcpSession(this.env, "execution", this.getSessionId());

    this.server.tool(
      "execute_strategy",
      "Queues and dispatches a scoped strategy execution through the internal executor",
      executeStrategySchema,
      async (args) => {
        const result = await queueStrategyThroughExecutor(this.env, scoped, {
          strategyKey: args.strategyKey,
          intent: args.intent as Record<string, unknown>,
          payload: args.payload as Record<string, unknown> | undefined,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      }
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
          "Access-Control-Allow-Headers": [
            "Content-Type",
            "X-NeuralRate-Internal-Token",
            "X-NeuralRate-Auth-Owner-Eoa",
            "X-NeuralRate-Auth-Nonce",
            "X-NeuralRate-Auth-Issued-At",
            "X-NeuralRate-Auth-Expires-At",
            "X-NeuralRate-Auth-Signature",
            "X-NeuralRate-Session-Token",
            "mcp-session-id",
            "mcp-protocol-version",
            "Accept",
          ].join(", "),
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
        const chainId = Number.parseInt(env.NEURALRATE_CHAIN_ID || "", 10);
        const automation = new AutomationStore(
          env.DECISIONS_DB,
          Number.isFinite(chainId) ? chainId : 5003
        );

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

        if (url.pathname === "/api/health" && request.method === "GET") {
          const health = {
            ok: true,
            envProfile: env.NEURALRATE_ENV_PROFILE || "demo",
            env: {
              hasFredApiKey: Boolean(env.FRED_API_KEY),
              hasNansenApiKey: Boolean(env.NANSEN_API_KEY),
              hasExecutorBaseUrl: Boolean(env.EXECUTOR_BASE_URL),
              hasRpcUrl: Boolean(env.MANTLE_SEPOLIA_RPC_URL),
              hasInternalToken: Boolean(getInternalApiToken(env)),
            },
            mcp: {
              canonicalRoute: MCP_CANONICAL_ROUTE,
              scopedRoutes: [
                MCP_SCOPED_ROUTE,
                MCP_SCOPED_STATE_ROUTE,
                MCP_SCOPED_CONFIG_ROUTE,
                MCP_SCOPED_BENCHMARK_ROUTE,
                MCP_SCOPED_EXECUTION_ROUTE,
              ],
            },
            timestamp: new Date().toISOString(),
          };

          return new Response(JSON.stringify(health), { headers: corsHeaders });
        }

        if (url.pathname === "/api/telemetry/error" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const source = typeof body.source === "string" ? body.source : "unknown";
          const level = typeof body.level === "string" ? body.level : "error";
          const message = typeof body.message === "string" ? body.message : "unknown error";
          const route = typeof body.route === "string" ? body.route : null;
          const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : null;
          const eventId = `evt_${crypto.randomUUID()}`;

          await env.DECISIONS_DB
            .prepare("INSERT INTO telemetry_events (event_id, source, level, message, route, metadata_json) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(eventId, source, level, message, route, metadata ? JSON.stringify(metadata) : null)
            .run();

          return new Response(JSON.stringify({ success: true, eventId }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/telemetry/summary" && request.method === "GET") {
          const { results } = await env.DECISIONS_DB
            .prepare("SELECT level, COUNT(*) as count FROM telemetry_events WHERE datetime(created_at) >= datetime('now', '-1 day') GROUP BY level")
            .all<Record<string, unknown>>();
          return new Response(JSON.stringify({ success: true, last24h: results }), { headers: corsHeaders });
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
          await assertReadAuthorized(request, env, ownerEoa);

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

          const state = await withOnchainPolicyState(await automation.getAutomationState(ownerEoa), env);
          return new Response(JSON.stringify({
            success: true,
            config,
            policySyncStatus: state.policySyncStatus,
            draftPolicy: state.draftPolicy,
            activeOnchainPolicy: state.activeOnchainPolicy,
          }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/vault" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertReadAuthorized(request, env, ownerEoa);

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
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertReadAuthorized(request, env, ownerEoa);
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

        const lineageMatch = url.pathname.match(/^\/api\/decisions\/([^/]+)\/lineage$/);
        if (lineageMatch && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertReadAuthorized(request, env, ownerEoa);
          const decisionId = decodeURIComponent(lineageMatch[1]);

          const row = await env.DECISIONS_DB
            .prepare("SELECT decision_id, data_snapshot_hash, allocation_json, applied_constraints_json, rationale_json, created_at FROM decisions WHERE decision_id = ? AND (requested_by = ? OR agent_address = ?) LIMIT 1")
            .bind(decisionId, ownerEoa.toLowerCase(), ownerEoa.toLowerCase())
            .first<Record<string, unknown>>();

          if (!row) {
            return new Response(JSON.stringify({ error: "Decision not found" }), { status: 404, headers: corsHeaders });
          }

          return new Response(JSON.stringify({ success: true, lineage: row }), { headers: corsHeaders });
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
          await assertReadAuthorized(request, env, ownerEoa);

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
          await assertReadAuthorized(request, env, ownerEoa);

          const state = await withOnchainPolicyState(await automation.getAutomationState(ownerEoa), env);
          return new Response(JSON.stringify(state), { headers: corsHeaders });
        }

        if (url.pathname === "/api/audit/summary" && request.method === "GET") {
          const ownerEoa = url.searchParams.get("ownerEoa");
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertReadAuthorized(request, env, ownerEoa);
          const state = await withOnchainPolicyState(await automation.getAutomationState(ownerEoa), env);
          const summary = buildAuditSummary(state as unknown as Record<string, unknown>);
          return new Response(JSON.stringify({ success: true, ...summary }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/grants/challenge" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          await assertMutationAuthorized(request, env, body, ownerEoa);
          const challenge = await createAutomationGrantChallenge(automation, {
            ownerEoa,
            agentSubject:
              typeof body.agentSubject === "string" && body.agentSubject.trim()
                ? body.agentSubject
                : "erc8004:49",
            allowedDomains: Array.isArray(body.allowedDomains) ? body.allowedDomains.map(String) : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
            expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
          });

          return new Response(JSON.stringify({ success: true, challenge }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/grants/prepare" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          await assertMutationAuthorized(request, env, body, ownerEoa);
          const challenge = await createAutomationGrantChallenge(automation, {
            ownerEoa,
            agentSubject:
              typeof body.agentSubject === "string" && body.agentSubject.trim()
                ? body.agentSubject
                : "erc8004:49",
            allowedDomains: Array.isArray(body.allowedDomains) ? body.allowedDomains.map(String) : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
            expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
          });

          return new Response(JSON.stringify({ success: true, challenge }), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/grants/issue" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const result = await issueAutomationGrant(automation, env, {
            ownerEoa,
            agentSubject:
              typeof body.agentSubject === "string" && body.agentSubject.trim()
                ? body.agentSubject
                : "erc8004:49",
            allowedDomains: Array.isArray(body.allowedDomains) ? body.allowedDomains.map(String) : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
            issuedAt: typeof body.issuedAt === "string" ? body.issuedAt : undefined,
            expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
            nonce: typeof body.nonce === "string" ? body.nonce : undefined,
            signature: typeof body.signature === "string" ? body.signature : undefined,
            issuedVia: typeof body.issuedVia === "string" ? body.issuedVia : "web",
          });

          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/grants/submit" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }

          const result = await issueAutomationGrant(automation, env, {
            ownerEoa,
            agentSubject:
              typeof body.agentSubject === "string" && body.agentSubject.trim()
                ? body.agentSubject
                : "erc8004:49",
            allowedDomains: Array.isArray(body.allowedDomains) ? body.allowedDomains.map(String) : undefined,
            policyVersion: typeof body.policyVersion === "string" ? body.policyVersion : undefined,
            issuedAt: typeof body.issuedAt === "string" ? body.issuedAt : undefined,
            expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : undefined,
            nonce: typeof body.nonce === "string" ? body.nonce : undefined,
            signature: typeof body.signature === "string" ? body.signature : undefined,
            issuedVia: typeof body.issuedVia === "string" ? body.issuedVia : "web",
          });

          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/grants/revoke" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          let grantId = typeof body.grantId === "string" ? body.grantId : null;

          const sessionToken = request.headers.get("x-neuralrate-session-token")?.trim();
          if (sessionToken) {
            const access = await resolveAutomationAccessFromSessionToken(automation, sessionToken, "state");
            grantId = access.grantId;
          } else {
            const ownerEoa = resolveMutationOwner(body);
            if (!ownerEoa) {
              return new Response(JSON.stringify({ error: "grantId, ownerEoa or x-neuralrate-session-token header is required" }), { status: 400, headers: corsHeaders });
            }
            await assertMutationAuthorized(request, env, body, ownerEoa);
            if (!grantId) {
              const activeGrant = await automation.getActiveAutomationGrant(ownerEoa);
              grantId = activeGrant?.grant_id ? String(activeGrant.grant_id) : null;
            }
          }

          if (!grantId) {
            return new Response(JSON.stringify({ error: "No active automation grant found to revoke." }), { status: 404, headers: corsHeaders });
          }

          const result = await revokeAutomationGrant(automation, grantId);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/policy/prepare-publish" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await preparePolicyPublish(automation, env, scoped);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/policy/submit-publish" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await submitPolicyPublish(
            automation,
            env,
            scoped,
            {
              txHash: typeof body.txHash === "string" ? body.txHash : null,
              expectedPolicy:
                body.expectedPolicy && typeof body.expectedPolicy === "object"
                  ? body.expectedPolicy as ExpectedPublishedPolicy
                  : null,
            }
          );
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/policy/prepare-revoke" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await preparePolicyRevoke(automation, env, scoped);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/policy/submit-revoke" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await submitPolicyRevoke(
            automation,
            env,
            scoped,
            typeof body.txHash === "string" ? body.txHash : null
          );
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/runtime/prepare-enable" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await prepareVaultRuntimeEnable(automation, env, scoped);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/runtime/submit-enable" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await submitVaultRuntimeEnable(
            automation,
            env,
            scoped,
            typeof body.txHashes === "object" && body.txHashes ? body.txHashes as Record<string, string> : undefined
          );
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/runtime/prepare-disable" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await prepareVaultRuntimeDisable(automation, env, scoped);
          return new Response(JSON.stringify(result), { headers: corsHeaders });
        }

        if (url.pathname === "/api/automation/runtime/submit-disable" && request.method === "POST") {
          const body = await readJsonBody<Record<string, unknown>>(request);
          const ownerEoa = resolveMutationOwner(body);
          if (!ownerEoa) {
            return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
          }
          await assertMutationAuthorized(request, env, body, ownerEoa);
          const scoped = await resolveOwnerControlAccess(automation, ownerEoa);
          const result = await submitVaultRuntimeDisable(
            automation,
            env,
            scoped,
            typeof body.txHashes === "object" && body.txHashes ? body.txHashes as Record<string, string> : undefined
          );
          return new Response(JSON.stringify(result), { headers: corsHeaders });
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
          if (isInternalMutationRequest(request, getInternalApiToken(env))) {
            const ownerEoa = resolveMutationOwner(body);
            if (!ownerEoa) {
              return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
            }

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

          const access = await resolveAutomationAccess(request, env, automation, body, "execution");
          const result = await queueStrategyThroughExecutor(env, access, {
            strategyKey: String(body.strategyKey),
            intent:
              typeof body.intent === "object" && body.intent
                ? body.intent as Record<string, unknown>
                : {},
            payload:
              typeof body.payload === "object" && body.payload
                ? body.payload as Record<string, unknown>
                : undefined,
          });

          return new Response(JSON.stringify(result), { headers: corsHeaders });
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
          if (isInternalMutationRequest(request, getInternalApiToken(env))) {
            const ownerEoa = resolveMutationOwner(body);
            if (!ownerEoa) {
              return new Response(JSON.stringify({ error: "ownerEoa is required" }), { status: 400, headers: corsHeaders });
            }

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

          const access = await resolveAutomationAccess(request, env, automation, body, "benchmark");
          const result = await queueBenchmarkThroughExecutor(env, access, {
            decisionId: String(body.decisionId),
            dataSnapshotHash: typeof body.dataSnapshotHash === "string" ? body.dataSnapshotHash : undefined,
            payload:
              typeof body.payload === "object" && body.payload
                ? body.payload as Record<string, unknown>
                : undefined,
          });

          return new Response(JSON.stringify(result), { headers: corsHeaders });
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

    const scopedCatalog = resolveScopedCatalogRoute(url);
    if (scopedCatalog) {
      try {
        await requireScopedCatalogAccess(request, env, scopedCatalog.domain);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        });
      }

      const targetUrl = new URL(request.url);
      if (scopedCatalog.route === MCP_SCOPED_STATE_ROUTE && targetUrl.pathname.startsWith(MCP_SCOPED_STATE_SSE_ALIAS_ROUTE)) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SCOPED_STATE_SSE_ALIAS_ROUTE, MCP_SCOPED_STATE_ROUTE);
      } else if (scopedCatalog.route === MCP_SCOPED_CONFIG_ROUTE && targetUrl.pathname.startsWith(MCP_SCOPED_CONFIG_SSE_ALIAS_ROUTE)) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SCOPED_CONFIG_SSE_ALIAS_ROUTE, MCP_SCOPED_CONFIG_ROUTE);
      } else if (
        scopedCatalog.route === MCP_SCOPED_BENCHMARK_ROUTE &&
        targetUrl.pathname.startsWith(MCP_SCOPED_BENCHMARK_SSE_ALIAS_ROUTE)
      ) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SCOPED_BENCHMARK_SSE_ALIAS_ROUTE, MCP_SCOPED_BENCHMARK_ROUTE);
      } else if (
        scopedCatalog.route === MCP_SCOPED_EXECUTION_ROUTE &&
        targetUrl.pathname.startsWith(MCP_SCOPED_EXECUTION_SSE_ALIAS_ROUTE)
      ) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SCOPED_EXECUTION_SSE_ALIAS_ROUTE, MCP_SCOPED_EXECUTION_ROUTE);
      } else if (targetUrl.pathname.startsWith(MCP_SCOPED_SSE_ALIAS_ROUTE)) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SCOPED_SSE_ALIAS_ROUTE, scopedCatalog.route);
      } else if (targetUrl.pathname === MCP_SCOPED_ROUTE) {
        targetUrl.pathname = scopedCatalog.route;
      }

      const mcpRequest = targetUrl.toString() === request.url
        ? request
        : new Request(targetUrl.toString(), request);

      const scopedAgent =
        scopedCatalog.domain === "state"
          ? NeuralRateStateMcpAgent
          : scopedCatalog.domain === "config"
          ? NeuralRateConfigMcpAgent
          : scopedCatalog.domain === "benchmark"
            ? NeuralRateBenchmarkMcpAgent
            : NeuralRateExecutionMcpAgent;

      const scopedBinding =
        scopedCatalog.domain === "state"
          ? "MCP_OBJECT"
          : scopedCatalog.domain === "config"
          ? "MCP_CONFIG_OBJECT"
          : scopedCatalog.domain === "benchmark"
            ? "MCP_BENCHMARK_OBJECT"
            : "MCP_EXECUTION_OBJECT";

      const mcpResponse = await (scopedAgent as any).serve(scopedCatalog.route, { binding: scopedBinding }).fetch(mcpRequest, env, ctx);
      const newHeaders = new Headers(mcpResponse.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      const issuedMcpSessionId = mcpResponse.headers.get("mcp-session-id");
      if (!request.headers.get("mcp-session-id") && issuedMcpSessionId) {
        await bindScopedMcpSession(env, scopedCatalog.domain, issuedMcpSessionId, await requireScopedCatalogAccess(request, env, scopedCatalog.domain));
      }
      return new Response(mcpResponse.body, {
        status: mcpResponse.status,
        statusText: mcpResponse.statusText,
        headers: newHeaders
      });
    }

    // Accept /mcp as canonical and /sse as a transport alias for the public read-only catalog.
    if (url.pathname.startsWith(MCP_CANONICAL_ROUTE) || url.pathname.startsWith(MCP_SSE_ALIAS_ROUTE)) {
      const targetUrl = new URL(request.url);
      if (targetUrl.pathname.startsWith(MCP_SSE_ALIAS_ROUTE)) {
        targetUrl.pathname = targetUrl.pathname.replace(MCP_SSE_ALIAS_ROUTE, MCP_CANONICAL_ROUTE);
      }

      const mcpRequest = targetUrl.toString() === request.url
        ? request
        : new Request(targetUrl.toString(), request);

      const mcpResponse = await (NeuralRateReadonlyMcpAgent as any)
        .serve(MCP_CANONICAL_ROUTE, { binding: "MCP_READONLY_OBJECT" })
        .fetch(mcpRequest, env, ctx);
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
