import { buildBenchmarkPolicy, buildExecutionPolicy } from "../../executor/src/policy.js";
import { AutomationStore, type UserAgentConfigInput } from "./automation";
import {
  buildAutomationGrantDraft,
  createSessionToken,
  hashSessionToken,
  type AutomationGrantDomain,
  verifyAutomationGrantSignature,
} from "./grants";

type ExecutorEnv = {
  EXECUTOR_BASE_URL?: string;
  INTERNAL_API_TOKEN?: string;
  NEURALRATE_BENCHMARK_CONTRACT: string;
  NEURALRATE_CHAIN_ID?: string;
};

export type ScopedAutomationAccess = {
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

const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const asNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const normalizeDomainList = (domains?: readonly string[]) =>
  Array.from(
    new Set(
      (domains ?? ["state", "config", "benchmark", "execution"])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const assertVaultReadyForGrant = (state: Awaited<ReturnType<AutomationStore["getAutomationState"]>>) => {
  if (!state.vault?.vault_id || !state.vault.vault_address) {
    throw new Error("Bootstrap the dedicated vault before issuing an automation grant.");
  }
  if (!state.vault.ownership_acknowledged_at) {
    throw new Error("Acknowledge wallet ownership before issuing an automation grant.");
  }
  if (!state.userId || !state.config) {
    throw new Error("User profile and agent policy must exist before issuing an automation grant.");
  }
};

export async function createAutomationGrantChallenge(
  store: AutomationStore,
  args: {
    ownerEoa: string;
    agentSubject: string;
    allowedDomains?: string[];
    policyVersion?: string | null;
    expiresAt?: string;
    issuedAt?: string;
    nonce?: string;
  }
) {
  const state = await store.getAutomationState(args.ownerEoa);
  assertVaultReadyForGrant(state);

  return buildAutomationGrantDraft({
    ownerEoa: state.ownerEoa,
    userId: String(state.userId!),
    vaultId: String(state.vault!.vault_id),
    vaultAddress: String(state.vault!.vault_address!),
    agentSubject: args.agentSubject,
    policyVersion: args.policyVersion ?? String(state.config!.policy_version ?? "vault-v1"),
    allowedDomains: normalizeDomainList(args.allowedDomains),
    expiresAt: args.expiresAt,
    issuedAt: args.issuedAt,
    nonce: args.nonce,
  });
}

export async function issueAutomationGrant(
  store: AutomationStore,
  env: ExecutorEnv,
  args: {
    ownerEoa: string;
    agentSubject: string;
    allowedDomains?: string[];
    policyVersion?: string | null;
    issuedAt?: string;
    expiresAt?: string;
    nonce?: string;
    signature?: string | null;
    issuedVia?: string | null;
  }
) {
  const parsedChainId = Number.parseInt(env.NEURALRATE_CHAIN_ID || "", 10);
  const resolvedChainId = Number.isFinite(parsedChainId) ? parsedChainId : 5003;
  const challenge = await createAutomationGrantChallenge(store, {
    ownerEoa: args.ownerEoa,
    agentSubject: args.agentSubject,
    allowedDomains: args.allowedDomains,
    policyVersion: args.policyVersion,
    expiresAt: args.expiresAt,
    issuedAt: args.issuedAt,
    nonce: args.nonce,
  });

  if (!args.signature) {
    return {
      success: true,
      requiresSignature: true,
      challenge,
    };
  }

  const verified = await verifyAutomationGrantSignature({
    ...challenge,
    signature: args.signature,
  });

  const state = await store.getAutomationState(challenge.ownerEoa);
  assertVaultReadyForGrant(state);

  const grantId = makeId("grant");
  const sessionId = makeId("mcp_session");
  const sessionToken = createSessionToken();
  const sessionTokenHash = await hashSessionToken(sessionToken);
  const executionPolicyId = makeId("policy");
  const benchmarkPolicyId = makeId("policy");
  const grantedDomains = normalizeDomainList(verified.allowedDomains);
  const issuedVia = args.issuedVia ?? "web";

  const executionPolicy = buildExecutionPolicy(
    {
      ownerEoa: challenge.ownerEoa,
      userId: challenge.userId,
      vaultId: challenge.vaultId,
      vaultAddress: challenge.vaultAddress,
      spendToken: "USDC",
      spendLimitPerUse: String(state.config?.max_action_usd ?? 1000),
      spendLimitDaily: String(state.config?.max_daily_usd ?? 2500),
      spendLimitTotal: String(state.config?.max_automation_usd ?? 10000),
      usageLimit: 25,
      validAfter: challenge.issuedAt,
      validUntil: challenge.expiresAt,
      allowedAssets: (state.config?.allowed_assets as string[] | undefined) ?? [],
      allowedProtocols: (state.config?.allowed_protocols as string[] | undefined) ?? [],
    },
    challenge.policyVersion
  );

  const benchmarkPolicy = buildBenchmarkPolicy(
    {
      ownerEoa: challenge.ownerEoa,
      userId: challenge.userId,
      vaultId: challenge.vaultId,
      vaultAddress: challenge.vaultAddress,
      validAfter: challenge.issuedAt,
      validUntil: challenge.expiresAt,
    },
    env.NEURALRATE_BENCHMARK_CONTRACT,
    challenge.policyVersion
  );

  await store.upsertPolicy({
    policyId: executionPolicyId,
    ownerEoa: challenge.ownerEoa,
    userSmartAccount: challenge.vaultAddress,
    chainId: resolvedChainId,
    status: "active",
    userId: challenge.userId,
    vaultId: challenge.vaultId,
    ...executionPolicy,
  });

  await store.upsertPolicy({
    policyId: benchmarkPolicyId,
    ownerEoa: challenge.ownerEoa,
    userSmartAccount: challenge.vaultAddress,
    chainId: resolvedChainId,
    status: "active",
    userId: challenge.userId,
    vaultId: challenge.vaultId,
    ...benchmarkPolicy,
  });

  await store.upsertAutomationGrant({
    grantId,
    ownerEoa: challenge.ownerEoa,
    userId: challenge.userId,
    vaultId: challenge.vaultId,
    vaultAddress: challenge.vaultAddress,
    agentSubject: challenge.agentSubject,
    policyVersion: challenge.policyVersion,
    allowedDomains: grantedDomains,
    nonce: challenge.nonce,
    signature: args.signature,
    grantMessage: verified.message,
    issuedVia,
    status: "active",
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
    sessionId,
  });

  await store.upsertMcpMutationSession({
    sessionId,
    grantId,
    ownerEoa: challenge.ownerEoa,
    userId: challenge.userId,
    vaultId: challenge.vaultId,
    vaultAddress: challenge.vaultAddress,
    agentSubject: challenge.agentSubject,
    policyVersion: challenge.policyVersion,
    allowedDomains: grantedDomains,
    sessionTokenHash,
    issuedVia,
    status: "active",
    issuedAt: challenge.issuedAt,
    expiresAt: challenge.expiresAt,
  });

  await store.upsertSession({
    sessionId,
    policyId: executionPolicyId,
    ownerEoa: challenge.ownerEoa,
    userSmartAccount: challenge.vaultAddress,
    agentSessionSigner: challenge.agentSubject,
    chainId: resolvedChainId,
    sessionStatus: "active",
    permissionId: grantId,
    sessionDetails: {
      grantId,
      benchmarkPolicyId,
      allowedDomains: grantedDomains,
      automationModel: "mcp-grant-session",
      issuedVia,
    },
    validAfter: challenge.issuedAt,
    validUntil: challenge.expiresAt,
    providerSessionRef: `grant:${challenge.agentSubject}`,
    providerPermissionRef: grantId,
    consentMessage: verified.message,
    consentSignature: args.signature,
    consentDigest: grantId,
    consentVerifiedAt: challenge.issuedAt,
    userId: challenge.userId,
    vaultId: challenge.vaultId,
    policyVersion: challenge.policyVersion,
  });

  return {
    success: true,
    requiresSignature: false,
    grantId,
    sessionId,
    sessionToken,
    ownerEoa: challenge.ownerEoa,
    userId: challenge.userId,
    vaultId: challenge.vaultId,
    vaultAddress: challenge.vaultAddress,
    agentSubject: challenge.agentSubject,
    policyVersion: challenge.policyVersion,
    allowedDomains: grantedDomains,
    grantExpiresAt: challenge.expiresAt,
  };
}

export async function revokeAutomationGrant(
  store: AutomationStore,
  grantId: string,
  revokedAt = new Date().toISOString()
) {
  const grant = await store.getAutomationGrant(grantId);
  if (!grant) {
    throw new Error("Automation grant not found.");
  }

  await store.revokeAutomationGrant(grantId, revokedAt);

  if (grant.session_id) {
    await store.revokeMcpMutationSession(String(grant.session_id), revokedAt);
  }

  const activeSession = grant.session_id
    ? await store.getSession(String(grant.session_id))
    : null;

  if (activeSession) {
    await store.upsertSession({
      sessionId: String(activeSession.session_id),
      policyId: String(activeSession.policy_id),
      ownerEoa: String(activeSession.owner_eoa),
      userSmartAccount: typeof activeSession.user_smart_account === "string" ? activeSession.user_smart_account : undefined,
      agentSessionSigner: String(activeSession.agent_session_signer),
      chainId: typeof activeSession.chain_id === "number" ? activeSession.chain_id : resolvedChainId,
      sessionStatus: "revoked",
      grantTxHash: typeof activeSession.grant_tx_hash === "string" ? activeSession.grant_tx_hash : undefined,
      revokeTxHash: null,
      permissionId: typeof activeSession.permission_id === "string" ? activeSession.permission_id : undefined,
      sessionDetails: activeSession.session_details,
      validAfter: typeof activeSession.valid_after === "string" ? activeSession.valid_after : undefined,
      validUntil: typeof activeSession.valid_until === "string" ? activeSession.valid_until : undefined,
      revokedAt,
      providerSessionRef: typeof activeSession.provider_session_ref === "string" ? activeSession.provider_session_ref : undefined,
      providerPermissionRef: typeof activeSession.provider_permission_ref === "string" ? activeSession.provider_permission_ref : undefined,
      consentMessage: typeof activeSession.consent_message === "string" ? activeSession.consent_message : undefined,
      consentSignature: typeof activeSession.consent_signature === "string" ? activeSession.consent_signature : undefined,
      consentDigest: typeof activeSession.consent_digest === "string" ? activeSession.consent_digest : undefined,
      consentVerifiedAt: typeof activeSession.consent_verified_at === "string" ? activeSession.consent_verified_at : undefined,
      turnkeySignerRef: typeof activeSession.turnkey_signer_ref === "string" ? activeSession.turnkey_signer_ref : undefined,
      userId: typeof activeSession.user_id === "string" ? activeSession.user_id : undefined,
      vaultId: typeof activeSession.vault_id === "string" ? activeSession.vault_id : undefined,
      policyVersion: typeof activeSession.policy_version === "string" ? activeSession.policy_version : undefined,
    });
  }

  return {
    success: true,
    grantId,
    revokedAt,
  };
}

export async function resolveAutomationAccessFromSessionToken(
  store: AutomationStore,
  sessionToken: string,
  requiredDomain: AutomationGrantDomain
): Promise<ScopedAutomationAccess> {
  const sessionTokenHash = await hashSessionToken(sessionToken);
  const session = await store.getMcpMutationSessionByTokenHash(sessionTokenHash);
  if (!session) {
    throw new Error("Unknown MCP mutation session.");
  }
  if (session.status !== "active" || session.revoked_at) {
    throw new Error("MCP mutation session is revoked.");
  }
  if (Date.parse(String(session.expires_at ?? "")) < Date.now()) {
    throw new Error("MCP mutation session has expired.");
  }
  if (!Array.isArray(session.allowed_domains) || !session.allowed_domains.includes(requiredDomain)) {
    throw new Error(`MCP mutation session is not authorized for the ${requiredDomain} domain.`);
  }

  await store.touchMcpMutationSession(String(session.session_id));

  return {
    ownerEoa: String(session.owner_eoa),
    userId: String(session.user_id),
    vaultId: String(session.vault_id),
    vaultAddress: String(session.vault_address),
    agentSubject: String(session.agent_subject),
    policyVersion: String(session.policy_version),
    sessionId: String(session.session_id),
    grantId: String(session.grant_id),
    allowedDomains: Array.isArray(session.allowed_domains) ? session.allowed_domains.map(String) : [],
    grantExpiresAt: String(session.expires_at),
    authMode: "session",
  };
}

export async function resolveAutomationAccessFromOwner(
  store: AutomationStore,
  ownerEoa: string,
  requiredDomain: AutomationGrantDomain
): Promise<ScopedAutomationAccess> {
  const grant = await store.getActiveAutomationGrant(ownerEoa);
  const session = await store.getActiveMcpMutationSession(ownerEoa);
  if (!grant || !session) {
    throw new Error("Enable automation and issue an active grant before dispatching this action.");
  }
  if (String(grant.grant_id) !== String(session.grant_id)) {
    throw new Error("Active MCP mutation session is no longer aligned with the current automation grant.");
  }
  if (!Array.isArray(grant.allowed_domains) || !grant.allowed_domains.includes(requiredDomain)) {
    throw new Error(`Active automation grant does not permit the ${requiredDomain} domain.`);
  }
  if (!Array.isArray(session.allowed_domains) || !session.allowed_domains.includes(requiredDomain)) {
    throw new Error(`Active MCP mutation session does not permit the ${requiredDomain} domain.`);
  }

  return {
    ownerEoa: String(grant.owner_eoa),
    userId: String(grant.user_id),
    vaultId: String(grant.vault_id),
    vaultAddress: String(grant.vault_address),
    agentSubject: String(grant.agent_subject),
    policyVersion: String(grant.policy_version),
    sessionId: String(session.session_id),
    grantId: String(grant.grant_id),
    allowedDomains: Array.isArray(grant.allowed_domains) ? grant.allowed_domains.map(String) : [],
    grantExpiresAt: String(grant.expires_at),
    authMode: "signed",
  };
}

export async function updateAgentPolicyFromScopedAccess(
  store: AutomationStore,
  access: ScopedAutomationAccess,
  patch: Record<string, unknown>
) {
  return store.upsertAgentConfig({
    ownerEoa: access.ownerEoa,
    userId: access.userId,
    vaultId: access.vaultId,
    objective: typeof patch.objective === "string" ? patch.objective as UserAgentConfigInput["objective"] : undefined,
    riskProfile: typeof patch.riskProfile === "string" ? patch.riskProfile as UserAgentConfigInput["riskProfile"] : undefined,
    horizonHours: typeof patch.horizonHours === "number" ? patch.horizonHours : undefined,
    automationMode: typeof patch.automationMode === "string" ? patch.automationMode as UserAgentConfigInput["automationMode"] : undefined,
    restrictionPreset: typeof patch.restrictionPreset === "string" ? patch.restrictionPreset as UserAgentConfigInput["restrictionPreset"] : undefined,
    allowedAssets: Array.isArray(patch.allowedAssets) ? patch.allowedAssets.map(String) : undefined,
    deniedAssets: Array.isArray(patch.deniedAssets) ? patch.deniedAssets.map(String) : undefined,
    allowedProtocols: Array.isArray(patch.allowedProtocols) ? patch.allowedProtocols.map(String) : undefined,
    deniedProtocols: Array.isArray(patch.deniedProtocols) ? patch.deniedProtocols.map(String) : undefined,
    maxProtocolWeightBps: typeof patch.maxProtocolWeightBps === "number" ? patch.maxProtocolWeightBps : undefined,
    maxAssetWeightBps: typeof patch.maxAssetWeightBps === "number" ? patch.maxAssetWeightBps : undefined,
    maxActionUsd: typeof patch.maxActionUsd === "number" ? patch.maxActionUsd : undefined,
    maxDailyUsd: typeof patch.maxDailyUsd === "number" ? patch.maxDailyUsd : undefined,
    maxAutomationUsd: typeof patch.maxAutomationUsd === "number" ? patch.maxAutomationUsd : undefined,
    maxSlippageBps: typeof patch.maxSlippageBps === "number" ? patch.maxSlippageBps : undefined,
    rebalanceCadenceHours: typeof patch.rebalanceCadenceHours === "number" ? patch.rebalanceCadenceHours : undefined,
    minApyBps: typeof patch.minApyBps === "number" ? patch.minApyBps : undefined,
    minSpreadOverTbillBps: typeof patch.minSpreadOverTbillBps === "number" ? patch.minSpreadOverTbillBps : undefined,
    requireManualAboveUsd: typeof patch.requireManualAboveUsd === "number" ? patch.requireManualAboveUsd : undefined,
    pauseOnRiskEvent: typeof patch.pauseOnRiskEvent === "boolean" ? patch.pauseOnRiskEvent : undefined,
    policyVersion: typeof patch.policyVersion === "string" ? patch.policyVersion : access.policyVersion,
  });
}

async function callExecutor<T>(
  env: ExecutorEnv,
  path: string,
  body: Record<string, unknown>
) {
  const executorBaseUrl = env.EXECUTOR_BASE_URL?.trim();
  if (!executorBaseUrl) {
    throw new Error("Worker EXECUTOR_BASE_URL is not configured.");
  }
  if (!env.INTERNAL_API_TOKEN?.trim()) {
    throw new Error("Worker INTERNAL_API_TOKEN is not configured.");
  }

  const response = await fetch(`${executorBaseUrl.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-NeuralRate-Internal-Token": env.INTERNAL_API_TOKEN,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Executor ${response.status} ${response.statusText}: ${text}`);
  }

  return (await response.json()) as T;
}

export async function queueBenchmarkThroughExecutor(
  env: ExecutorEnv,
  access: ScopedAutomationAccess,
  args: {
    decisionId: string;
    dataSnapshotHash?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  return callExecutor<{
    success: boolean;
    benchmarkJob: Record<string, unknown>;
    executionCapable: boolean;
  }>(env, "/v1/automation/benchmark-jobs", {
    decisionId: args.decisionId,
    ownerEoa: access.ownerEoa,
    sessionId: access.sessionId,
    dataSnapshotHash: args.dataSnapshotHash ?? null,
    payload: {
      userId: access.userId,
      vaultId: access.vaultId,
      policyVersion: access.policyVersion,
      ...(args.payload ?? {}),
    },
  });
}

export async function queueStrategyThroughExecutor(
  env: ExecutorEnv,
  access: ScopedAutomationAccess,
  args: {
    strategyKey: string;
    intent: Record<string, unknown>;
    payload?: Record<string, unknown>;
  }
) {
  return callExecutor<{
    success: boolean;
    job: Record<string, unknown>;
    executionCapable: boolean;
  }>(env, "/v1/automation/jobs", {
    sessionId: access.sessionId,
    ownerEoa: access.ownerEoa,
    vaultAddress: access.vaultAddress,
    executionDomain: "execution",
    jobType: "strategy-execution",
    strategyKey: args.strategyKey,
    intent: args.intent,
    payload: {
      userId: access.userId,
      vaultId: access.vaultId,
      policyVersion: access.policyVersion,
      ...(args.payload ?? {}),
    },
  });
}

export async function buildScopedDecisionPayload(
  store: AutomationStore,
  access: ScopedAutomationAccess,
  amountUsd: number
) {
  const state = await store.getAutomationState(access.ownerEoa);
  return {
    ownerEoa: access.ownerEoa,
    amountUsd,
    objective: state.config?.objective ?? "income",
    riskProfile: state.config?.risk_profile ?? "medium",
    horizonHours: state.config?.horizon_hours ?? 24,
    allowedAssets: Array.isArray(state.config?.allowed_assets) ? state.config.allowed_assets : [],
    deniedAssets: Array.isArray(state.config?.denied_assets) ? state.config.denied_assets : [],
    allowedProtocols: Array.isArray(state.config?.allowed_protocols) ? state.config.allowed_protocols : [],
    deniedProtocols: Array.isArray(state.config?.denied_protocols) ? state.config.denied_protocols : [],
    maxProtocolWeightBps: asNumber(state.config?.max_protocol_weight_bps, 5000),
    maxAssetWeightBps: asNumber(state.config?.max_asset_weight_bps, 5000),
    maxActionUsd: asNumber(state.config?.max_action_usd, 1000),
    stableOnly: state.config?.restriction_preset === "stable-only",
    minSpreadOverTbillBps: asNumber(state.config?.min_spread_over_tbill_bps, 0),
    automationMode: state.config?.automation_mode ?? "auto-within-limits",
    restrictionPreset: state.config?.restriction_preset ?? "blue-chip-defi",
  };
}
