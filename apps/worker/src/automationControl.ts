import { buildBenchmarkPolicy, buildExecutionPolicy } from "./policy";
import { AutomationStore, type UserAgentConfigInput } from "./automation";
import {
  buildAutomationGrantDraft,
  createSessionToken,
  hashSessionToken,
  type AutomationGrantDomain,
  verifyAutomationGrantSignature,
} from "./grants";
import { withOnchainPolicyState } from "./onchainState";
import { encodeFunctionData, type Address } from "viem";

type ExecutorServiceBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type ExecutorEnv = {
  EXECUTOR?: ExecutorServiceBinding;
  EXECUTOR_BASE_URL?: string;
  INTERNAL_API_TOKEN?: string;
  NEURALRATE_INTERNAL_API_TOKEN?: string;
  NEURALRATE_ENV_PROFILE?: string;
  NEURALRATE_BENCHMARK_CONTRACT: string;
  NEURALRATE_CHAIN_ID?: string;
  NEURALRATE_POLICY_REGISTRY_CONTRACT?: string;
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?: string;
  NEURALRATE_VAULT_MODULE_ADDRESS?: string;
  NEURALRATE_EXECUTION_GUARD_CONTRACT?: string;
  NEURALRATE_SAFE_7579_ADAPTER_ADDRESS?: string;
  NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS?: string;
  NEURALRATE_DELEGATE_VALIDATOR_ADDRESS?: string;
  NEURALRATE_4337_ENTRYPOINT_ADDRESS?: string;
  NEURALRATE_ERC7484_REGISTRY_ADDRESS?: string;
  NEURALRATE_PAYMASTER_ENABLED?: string;
  MANTLE_SEPOLIA_RPC_URL?: string;
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

export type RotatedMcpSessionAccess = ScopedAutomationAccess & {
  sessionToken: string;
};

type PreparedTxRequest = {
  from: string;
  to: string;
  data: string;
  value: string;
};

export type ExpectedPublishedPolicy = {
  ownerEoa: string;
  vaultAddress: string;
  delegate: string;
  maxPerUse: number;
  maxDaily: number;
  maxTotal: number;
  validAfter: number;
  validUntil: number;
  maxSlippageBps: number;
  requireSnapshot: boolean;
  policyVersion: string;
  allowedAssets: string[];
  allowedProtocols: string[];
  allowedTargets: string[];
  allowedSelectors: string[];
};

export type PolicyPublishNextAction = {
  type: "none" | "publish_policy";
  label: string;
  required: boolean;
  ownerSignatureRequired: boolean;
  tools: string[];
  message: string;
};

export const buildPolicyPublishNextAction = (
  policySyncStatus: "not_published" | "in_sync" | "drifted" | "pending_publish" | "pending_revoke" | string | null | undefined
): PolicyPublishNextAction => {
  if (policySyncStatus === "drifted" || policySyncStatus === "pending_publish" || policySyncStatus === "not_published") {
    return {
      type: "publish_policy",
      label: "publish_policy",
      required: true,
      ownerSignatureRequired: true,
      tools: ["prepare_policy_publish", "submit_policy_publish"],
      message: "Policy draft saved. Call prepare_policy_publish, have the owner sign the transaction, then call submit_policy_publish with the tx hash and expectedPolicy.",
    };
  }

  return {
    type: "none",
    label: policySyncStatus === "pending_revoke" ? "pending_revoke" : "policy_in_sync",
    required: false,
    ownerSignatureRequired: false,
    tools: [],
    message: policySyncStatus === "pending_revoke"
      ? "A policy revoke is pending; do not publish a new policy until revoke completes or is cancelled."
      : "Draft policy already matches the active on-chain policy.",
  };
};

const policyRegistryAbi = [
  {
    type: "function",
    name: "publishPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ownerEoa", type: "address" },
      { name: "vaultAddress", type: "address" },
      { name: "delegate", type: "address" },
      { name: "maxPerUse", type: "uint256" },
      { name: "maxDaily", type: "uint256" },
      { name: "maxTotal", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "maxSlippageBps", type: "uint256" },
      { name: "requireSnapshot", type: "bool" },
      { name: "policyVersion", type: "string" },
      { name: "allowedAssets", type: "string[]" },
      { name: "allowedProtocols", type: "string[]" },
      { name: "allowedTargets", type: "address[]" },
      { name: "allowedSelectors", type: "bytes4[]" },
    ],
    outputs: [{ name: "policyId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "revokeActivePolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ownerEoa", type: "address" },
      { name: "vaultAddress", type: "address" },
    ],
    outputs: [],
  },
] as const;

const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONCHAIN_SETTLEMENT_DELAYS_MS = [0, 1200, 2500, 4500] as const;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const normalizeStringList = (values: unknown, transform: "upper" | "lower" | "trim" = "trim") =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
        .map((value) =>
          transform === "upper" ? value.toUpperCase() : transform === "lower" ? value.toLowerCase() : value
        )
    )
  );

const buildPreparedTxRequest = (
  ownerEoa: string,
  to: string,
  data: string
): PreparedTxRequest => ({
  from: ownerEoa,
  to,
  data,
  value: "0x0",
});

const buildCanonicalExecutionSurface = (env: ExecutorEnv) => {
  const allowedTargets: string[] = [];
  const allowedSelectors = [
    "0x00000000",
    "0xa9059cbb",
    "0x095ea7b3",
  ];

  return {
    allowedTargets,
    allowedSelectors,
  };
};

const asRecord = (value: unknown) =>
  value && typeof value === "object" ? value as Record<string, unknown> : null;

const firstPolicyNumber = (draft: Record<string, unknown>, keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = draft[key];
    if (value !== undefined && value !== null) {
      return asNumber(value, fallback);
    }
  }
  return fallback;
};

const firstPolicyValue = (draft: Record<string, unknown>, keys: string[], fallback: unknown) => {
  for (const key of keys) {
    const value = draft[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return fallback;
};

const buildExpectedPublishedPolicy = (
  access: ScopedAutomationAccess,
  env: ExecutorEnv,
  state: Awaited<ReturnType<typeof withOnchainPolicyState<Record<string, unknown>>>>,
  validAfter: number,
  validUntil: number
): ExpectedPublishedPolicy => {
  const draft = asRecord(state.draftPolicy ?? state.config);
  const vault = asRecord(state.vault);
  if (!draft) {
    throw new Error("No draft policy found for this owner.");
  }
  const vaultAddress = typeof vault?.vault_address === "string" ? vault.vault_address : null;
  if (!vaultAddress) {
    throw new Error("Bootstrap the vault before publishing policy.");
  }
  if (!env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?.trim() || /^0x0{40}$/i.test(env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS)) {
    throw new Error("NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS is not configured.");
  }

  const executionSurface = buildCanonicalExecutionSurface(env);

  return {
    ownerEoa: access.ownerEoa.toLowerCase(),
    vaultAddress: vaultAddress.toLowerCase(),
    delegate: env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS.toLowerCase(),
    maxPerUse: Math.max(0, Math.trunc(firstPolicyNumber(draft, ["maxPerUse", "max_action_usd"], 1000))),
    maxDaily: Math.max(0, Math.trunc(firstPolicyNumber(draft, ["maxDaily", "max_daily_usd"], 2500))),
    maxTotal: Math.max(0, Math.trunc(firstPolicyNumber(draft, ["maxTotal", "max_automation_usd"], 10000))),
    validAfter,
    validUntil,
    maxSlippageBps: Math.max(0, Math.trunc(firstPolicyNumber(draft, ["maxSlippageBps", "max_slippage_bps"], 50))),
    requireSnapshot: true,
    policyVersion: String(firstPolicyValue(draft, ["policyVersion", "policy_version"], access.policyVersion ?? "vault-v1")),
    allowedAssets: normalizeStringList(firstPolicyValue(draft, ["allowedAssets", "allowed_assets"], []), "upper"),
    allowedProtocols: normalizeStringList(firstPolicyValue(draft, ["allowedProtocols", "allowed_protocols"], []), "upper"),
    allowedTargets: executionSurface.allowedTargets,
    allowedSelectors: executionSurface.allowedSelectors,
  };
};

const matchesExpectedPublishedPolicy = (
  activePolicy: Record<string, unknown> | null | undefined,
  expected: ExpectedPublishedPolicy
) => {
  if (!activePolicy) {
    return false;
  }

  return (
    String(activePolicy.ownerEoa ?? "").toLowerCase() === expected.ownerEoa &&
    String(activePolicy.vaultAddress ?? "").toLowerCase() === expected.vaultAddress &&
    String(activePolicy.delegate ?? "").toLowerCase() === expected.delegate &&
    asNumber(activePolicy.maxPerUse, -1) === expected.maxPerUse &&
    asNumber(activePolicy.maxDaily, -1) === expected.maxDaily &&
    asNumber(activePolicy.maxTotal, -1) === expected.maxTotal &&
    asNumber(activePolicy.validAfter, -1) === expected.validAfter &&
    asNumber(activePolicy.validUntil, -1) === expected.validUntil &&
    asNumber(activePolicy.maxSlippageBps, -1) === expected.maxSlippageBps &&
    Boolean(activePolicy.requireSnapshot) === expected.requireSnapshot &&
    String(activePolicy.policyVersion ?? "") === expected.policyVersion &&
    JSON.stringify(normalizeStringList(activePolicy.allowedAssets, "upper")) === JSON.stringify(expected.allowedAssets) &&
    JSON.stringify(normalizeStringList(activePolicy.allowedProtocols, "upper")) === JSON.stringify(expected.allowedProtocols) &&
    JSON.stringify(normalizeStringList(activePolicy.allowedTargets, "lower")) === JSON.stringify(expected.allowedTargets) &&
    JSON.stringify(normalizeStringList(activePolicy.allowedSelectors, "lower")) === JSON.stringify(expected.allowedSelectors)
  );
};

const readOnchainAutomationState = async (
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess
) => withOnchainPolicyState(await store.getAutomationState(access.ownerEoa), env);

const assertVaultReadyForGrant = (state: Awaited<ReturnType<AutomationStore["getAutomationState"]>>) => {
  if (!state.vault?.vault_id || !state.vault.vault_address) {
    throw new Error("Bootstrap the dedicated vault before issuing an automation grant.");
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
  if (!state.vault?.ownership_acknowledged_at) {
    await store.acknowledgeVaultOwnership({
      ownerEoa: challenge.ownerEoa,
      userId: challenge.userId,
      vaultId: challenge.vaultId,
    });
  }

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
  const resolvedChainId = 5003;
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

export async function rotateActiveMcpSessionToken(
  store: AutomationStore,
  ownerEoa: string
): Promise<RotatedMcpSessionAccess> {
  const grant = await store.getActiveAutomationGrant(ownerEoa);
  const session = await store.getActiveMcpMutationSession(ownerEoa);
  if (!grant || !session) {
    throw new Error("Enable automation and issue an active grant before requesting MCP access.");
  }
  if (String(grant.grant_id) !== String(session.grant_id)) {
    throw new Error("Active MCP mutation session is no longer aligned with the current automation grant.");
  }

  const allowedDomains = Array.isArray(session.allowed_domains)
    ? normalizeDomainList(session.allowed_domains.map(String))
    : Array.isArray(grant.allowed_domains)
      ? normalizeDomainList(grant.allowed_domains.map(String))
      : [];
  if (allowedDomains.length === 0) {
    throw new Error("Active automation grant does not expose any MCP domains.");
  }

  const rotatedSessionId = makeId("mcp_session");
  const rotatedAt = new Date().toISOString();
  const sessionToken = createSessionToken();
  const sessionTokenHash = await hashSessionToken(sessionToken);

  await store.revokeMcpMutationSession(String(session.session_id), rotatedAt);
  await store.upsertMcpMutationSession({
    sessionId: rotatedSessionId,
    grantId: String(session.grant_id),
    ownerEoa: String(session.owner_eoa),
    userId: String(session.user_id),
    vaultId: String(session.vault_id),
    vaultAddress: String(session.vault_address),
    agentSubject: String(session.agent_subject),
    policyVersion: String(session.policy_version),
    allowedDomains,
    sessionTokenHash,
    issuedVia: typeof session.issued_via === "string" ? session.issued_via : "web",
    status: "active",
    issuedAt: rotatedAt,
    expiresAt:
      typeof session.expires_at === "string"
        ? session.expires_at
        : String(grant.expires_at),
    lastUsedAt: null,
    revokedAt: null,
  });

  await store.upsertAutomationGrant({
    grantId: String(grant.grant_id),
    ownerEoa: String(grant.owner_eoa),
    userId: String(grant.user_id),
    vaultId: String(grant.vault_id),
    vaultAddress: String(grant.vault_address),
    agentSubject: String(grant.agent_subject),
    policyVersion: String(grant.policy_version),
    allowedDomains,
    nonce: String(grant.nonce),
    signature: String(grant.signature),
    grantMessage: String(grant.grant_message),
    issuedVia: typeof grant.issued_via === "string" ? grant.issued_via : "web",
    status: "active",
    issuedAt: String(grant.issued_at),
    expiresAt: String(grant.expires_at),
    revokedAt: null,
    sessionId: rotatedSessionId,
  });

  return {
    ownerEoa: String(grant.owner_eoa),
    userId: String(grant.user_id),
    vaultId: String(grant.vault_id),
    vaultAddress: String(grant.vault_address),
    agentSubject: String(grant.agent_subject),
    policyVersion: String(grant.policy_version),
    sessionId: rotatedSessionId,
    grantId: String(grant.grant_id),
    allowedDomains,
    grantExpiresAt: String(session.expires_at ?? grant.expires_at),
    authMode: "session",
    sessionToken,
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

export async function preparePolicyPublish(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess
) {
  if (!env.NEURALRATE_POLICY_REGISTRY_CONTRACT?.trim()) {
    throw new Error("NEURALRATE_POLICY_REGISTRY_CONTRACT is not configured.");
  }
  if (!env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?.trim() || /^0x0{40}$/i.test(env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS)) {
    throw new Error("NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS is not configured.");
  }

  const state = await withOnchainPolicyState(await store.getAutomationState(access.ownerEoa), env);
  if (!state.vault?.vault_address) {
    throw new Error("Bootstrap the vault before publishing policy.");
  }

  const now = Math.floor(Date.now() / 1000);
  const validUntil = now + 12 * 60 * 60;
  const expectedPolicy = buildExpectedPublishedPolicy(access, env, state, now, validUntil);

  const data = encodeFunctionData({
    abi: policyRegistryAbi,
    functionName: "publishPolicy",
    args: [
      access.ownerEoa as Address,
      String(state.vault.vault_address) as Address,
      env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS as Address,
      BigInt(expectedPolicy.maxPerUse) * 10n ** 18n,
      BigInt(expectedPolicy.maxDaily) * 10n ** 18n,
      BigInt(expectedPolicy.maxTotal) * 10n ** 18n,
      BigInt(expectedPolicy.validAfter),
      BigInt(expectedPolicy.validUntil),
      BigInt(expectedPolicy.maxSlippageBps),
      expectedPolicy.requireSnapshot,
      expectedPolicy.policyVersion,
      expectedPolicy.allowedAssets,
      expectedPolicy.allowedProtocols,
      expectedPolicy.allowedTargets as Address[],
      expectedPolicy.allowedSelectors as `0x${string}`[],
    ],
  });

  return {
    success: true,
    policySyncStatus: state.policySyncStatus,
    draftPolicy: state.draftPolicy,
    activeOnchainPolicy: state.activeOnchainPolicy,
    expectedPolicy,
    txRequest: buildPreparedTxRequest(
      access.ownerEoa,
      env.NEURALRATE_POLICY_REGISTRY_CONTRACT,
      data
    ),
  };
}

export async function submitPolicyPublish(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess,
  args?: {
    txHash?: string | null;
    expectedPolicy?: ExpectedPublishedPolicy | null;
  }
) {
  if (!args?.expectedPolicy) {
    throw new Error("expectedPolicy is required to verify the published on-chain policy.");
  }

  let state: Awaited<ReturnType<typeof readOnchainAutomationState>> | null = null;
  for (const delayMs of ONCHAIN_SETTLEMENT_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }
    state = await readOnchainAutomationState(store, env, access);
    if (matchesExpectedPublishedPolicy(asRecord(state.activeOnchainPolicy), args.expectedPolicy)) {
      break;
    }
  }

  if (!state?.activeOnchainPolicy) {
    throw new Error("No active on-chain policy found after publish.");
  }
  if (!matchesExpectedPublishedPolicy(asRecord(state.activeOnchainPolicy), args.expectedPolicy)) {
    throw new Error("Published on-chain policy does not match the prepared draft.");
  }

  return {
    success: true,
    txHash: args.txHash ?? null,
    policySyncStatus: state.policySyncStatus,
    draftPolicy: state.draftPolicy,
    activeOnchainPolicy: state.activeOnchainPolicy,
  };
}

export async function preparePolicyRevoke(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess
) {
  if (!env.NEURALRATE_POLICY_REGISTRY_CONTRACT?.trim()) {
    throw new Error("NEURALRATE_POLICY_REGISTRY_CONTRACT is not configured.");
  }

  const state = await withOnchainPolicyState(await store.getAutomationState(access.ownerEoa), env);
  if (!state.vault?.vault_address) {
    throw new Error("Bootstrap the vault before revoking policy.");
  }

  const data = encodeFunctionData({
    abi: policyRegistryAbi,
    functionName: "revokeActivePolicy",
    args: [access.ownerEoa as Address, String(state.vault.vault_address) as Address],
  });

  return {
    success: true,
    policySyncStatus: state.activeOnchainPolicy ? "pending_revoke" : state.policySyncStatus,
    activeOnchainPolicy: state.activeOnchainPolicy,
    txRequest: buildPreparedTxRequest(
      access.ownerEoa,
      env.NEURALRATE_POLICY_REGISTRY_CONTRACT,
      data
    ),
  };
}

export async function submitPolicyRevoke(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess,
  txHash?: string | null
) {
  let state: Awaited<ReturnType<typeof readOnchainAutomationState>> | null = null;
  for (const delayMs of ONCHAIN_SETTLEMENT_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }
    state = await readOnchainAutomationState(store, env, access);
    if (!state.activeOnchainPolicy) {
      break;
    }
  }

  if (!state) {
    throw new Error("Unable to refresh on-chain policy state after revoke.");
  }
  if (state.activeOnchainPolicy) {
    throw new Error("On-chain policy is still active after revoke.");
  }

  return {
    success: true,
    txHash: txHash ?? null,
    policySyncStatus: state.policySyncStatus,
    draftPolicy: state.draftPolicy,
    activeOnchainPolicy: null,
  };
}

export async function prepareVaultRuntimeEnable(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess
) {
  const state = await withOnchainPolicyState(await store.getAutomationState(access.ownerEoa), env);
  if (!state.vault?.vault_address) {
    throw new Error("Bootstrap the vault before enabling runtime.");
  }

  const runtime = state.runtimeState;
  const needsSafe7579 =
    Boolean(env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS) &&
    Boolean(env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS);

  if (!env.NEURALRATE_VAULT_MODULE_ADDRESS || !needsSafe7579 || !env.NEURALRATE_EXECUTION_GUARD_CONTRACT) {
    throw new Error("Safe7579/ERC-4337 runtime is required for onboarding. Configure the vault module, Safe7579 adapter, delegate validator, and execution guard before enabling automation.");
  }
  if (env.NEURALRATE_EXECUTION_GUARD_CONTRACT && runtime?.trustedModuleReady === false) {
    throw new Error("Execution guard is not configured to trust the NeuralRate vault module. Fix the deployment configuration before onboarding users.");
  }
  if (
    env.NEURALRATE_PAYMASTER_ENABLED?.trim().toLowerCase() === "true" &&
    runtime?.trustedSafeModuleReady === false
  ) {
    throw new Error("Execution guard is not configured to trust the Safe7579 adapter required for sponsored ERC-4337 execution.");
  }

  const actions = [
    !runtime?.safeDeployed
      ? {
          key: "deploy_safe",
          label: "Deploy Safe",
          required: true,
          mode: "wallet_tx",
        }
      : null,
    env.NEURALRATE_VAULT_MODULE_ADDRESS && !runtime?.vaultModuleEnabled
      ? {
          key: "enable_vault_module",
          label: "Enable vault module",
          required: true,
          mode: "wallet_tx",
        }
      : null,
    needsSafe7579 && !runtime?.safe7579Enabled
      ? {
          key: "install_safe7579",
          label: "Install Safe7579",
          required: true,
          mode: "wallet_tx",
        }
      : null,
    needsSafe7579 && !runtime?.delegateReady
      ? {
          key: "configure_delegate_validator",
          label: runtime?.installedDelegate && runtime.installedDelegate !== ZERO_ADDRESS ? "Rotate delegate validator" : "Install delegate validator",
          required: true,
          mode: "wallet_tx",
        }
      : null,
    needsSafe7579 && !runtime?.fallbackHandlerReady
      ? {
          key: "enable_fallback_handler",
          label: "Enable fallback handler",
          required: true,
          mode: "wallet_tx",
        }
      : null,
    env.NEURALRATE_EXECUTION_GUARD_CONTRACT && !runtime?.moduleGuardReady
      ? {
          key: "enable_execution_guard",
          label: "Enable execution guard",
          required: true,
          mode: "wallet_tx",
        }
      : null,
  ].filter(Boolean);

  return {
    success: true,
    runtimeState: runtime,
    actions,
    targetRuntime: {
      vaultAddress: state.vault.vault_address,
      moduleAddress: env.NEURALRATE_VAULT_MODULE_ADDRESS ?? null,
      safe7579AdapterAddress: env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS ?? null,
      safe7579LaunchpadAddress: env.NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS ?? null,
      delegateValidatorAddress: env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS ?? null,
      executionGuardAddress: env.NEURALRATE_EXECUTION_GUARD_CONTRACT ?? null,
    },
  };
}

export function isVaultRuntimeInstallReady(
  runtime: Record<string, unknown> | null | undefined,
  requirements: {
    requiresVaultModule: boolean;
    requiresSafe7579: boolean;
    requiresExecutionGuard: boolean;
    requiresTrustedSafeModule?: boolean;
  }
) {
  return Boolean(
    runtime?.safeDeployed &&
    (!requirements.requiresVaultModule || runtime.vaultModuleEnabled === true) &&
    (
      !requirements.requiresSafe7579 ||
      (runtime.safe7579Enabled === true && runtime.delegateReady === true && runtime.fallbackHandlerReady === true)
    ) &&
    (
      !requirements.requiresExecutionGuard ||
      (
        runtime.moduleGuardReady === true &&
        runtime.trustedModuleReady === true &&
        (!requirements.requiresTrustedSafeModule || runtime.trustedSafeModuleReady === true)
      )
    )
  );
}

export async function submitVaultRuntimeEnable(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess,
  txHashes?: Record<string, string>
) {
  const requiresVaultModule = Boolean(env.NEURALRATE_VAULT_MODULE_ADDRESS);
  const requiresSafe7579 =
    Boolean(env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS) &&
    Boolean(env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS);
  const requiresExecutionGuard = Boolean(env.NEURALRATE_EXECUTION_GUARD_CONTRACT);
  const requiresTrustedSafeModule = env.NEURALRATE_PAYMASTER_ENABLED?.trim().toLowerCase() === "true";

  let state: Awaited<ReturnType<typeof readOnchainAutomationState>> | null = null;
  let runtime: Record<string, unknown> | null = null;
  let ready = false;
  for (const delayMs of ONCHAIN_SETTLEMENT_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }
    state = await readOnchainAutomationState(store, env, access);
    runtime = state.runtimeState;
    ready = isVaultRuntimeInstallReady(runtime, {
      requiresVaultModule,
      requiresSafe7579,
      requiresExecutionGuard,
      requiresTrustedSafeModule,
    });
    if (ready) {
      break;
    }
  }

  if (!state) {
    throw new Error("Unable to refresh runtime state after enable.");
  }
  if (!ready) {
    throw new Error("Vault runtime is not yet fully enabled on-chain.");
  }

  if (state.vault?.vault_id) {
    await store.upsertVault({
      ownerEoa: access.ownerEoa,
      userId: access.userId,
      vaultId: access.vaultId,
      vaultAddress: String(state.vault.vault_address),
      automationStatus: "runtime_enabled",
      safeDeploymentStatus: runtime?.safeDeployed ? "deployed" : "pending",
      status: runtime?.safeDeployed ? "active" : typeof state.vault.status === "string" ? state.vault.status : undefined,
    });
  }

  return {
    success: true,
    txHashes: txHashes ?? {},
    runtimeState: runtime,
  };
}

export async function prepareVaultRuntimeDisable(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess
) {
  const state = await withOnchainPolicyState(await store.getAutomationState(access.ownerEoa), env);

  return {
    success: true,
    runtimeState: state.runtimeState,
    actions: state.runtimeState?.vaultModuleEnabled
      ? [
          {
            key: "disable_vault_module",
            label: "Disable vault module",
            required: true,
            mode: "wallet_tx",
          },
        ]
      : [],
  };
}

export async function submitVaultRuntimeDisable(
  store: AutomationStore,
  env: ExecutorEnv,
  access: ScopedAutomationAccess,
  txHashes?: Record<string, string>
) {
  let state: Awaited<ReturnType<typeof readOnchainAutomationState>> | null = null;
  for (const delayMs of ONCHAIN_SETTLEMENT_DELAYS_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }
    state = await readOnchainAutomationState(store, env, access);
    if (!state.runtimeState?.vaultModuleEnabled) {
      break;
    }
  }

  if (!state) {
    throw new Error("Unable to refresh runtime state after disable.");
  }
  if (state.vault?.vault_id) {
    await store.upsertVault({
      ownerEoa: access.ownerEoa,
      userId: access.userId,
      vaultId: access.vaultId,
      vaultAddress: String(state.vault.vault_address),
      automationStatus: state.runtimeState?.vaultModuleEnabled ? "runtime_partial" : "runtime_disabled",
      safeDeploymentStatus: state.runtimeState?.safeDeployed ? "deployed" : "pending",
    });
  }

  return {
    success: true,
    txHashes: txHashes ?? {},
    runtimeState: state.runtimeState,
  };
}

async function callExecutor<T>(
  env: ExecutorEnv,
  path: string,
  body: Record<string, unknown>
) {
  const internalApiToken = env.NEURALRATE_INTERNAL_API_TOKEN?.trim() || env.INTERNAL_API_TOKEN?.trim();
  if (!internalApiToken) {
    throw new Error("Worker INTERNAL_API_TOKEN is not configured.");
  }

  const envProfile = (env.NEURALRATE_ENV_PROFILE || "").trim().toLowerCase();
  const isProductionProfile = envProfile === "production";
  const serviceBinding = env.EXECUTOR;
  let response: Response;
  let executorOrigin = "service-binding://EXECUTOR";

  if (serviceBinding) {
    response = await serviceBinding.fetch(`https://executor.internal${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NeuralRate-Internal-Token": internalApiToken,
      },
      body: JSON.stringify(body),
    });
  } else {
    const executorBaseUrl = env.EXECUTOR_BASE_URL?.trim();
    if (!executorBaseUrl) {
      throw new Error("Worker EXECUTOR service binding is not configured, and EXECUTOR_BASE_URL fallback is empty.");
    }

    let executorUrl: URL;
    try {
      executorUrl = new URL(executorBaseUrl);
    } catch {
      throw new Error(`Worker EXECUTOR_BASE_URL is invalid: ${executorBaseUrl}`);
    }

    const isLoopbackHost =
      executorUrl.hostname === "localhost" ||
      executorUrl.hostname === "0.0.0.0" ||
      executorUrl.hostname === "::1" ||
      executorUrl.hostname.startsWith("127.");

    if (isProductionProfile && isLoopbackHost) {
      throw new Error(
        `Worker EXECUTOR_BASE_URL points to a local-only host (${executorUrl.origin}). Production must use the EXECUTOR service binding or a non-loopback fallback during migration.`
      );
    }

    executorOrigin = executorUrl.origin;
    response = await fetch(`${executorUrl.origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-NeuralRate-Internal-Token": internalApiToken,
      },
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 403 && /error code:\s*1003/i.test(text)) {
      throw new Error(
        `Executor origin ${executorOrigin} is not reachable from the worker. Cloudflare returned 403/1003, which usually means the fallback EXECUTOR_BASE_URL is pointing at the wrong host.`
      );
    }
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
