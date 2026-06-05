import { AutomationStore } from "./automation";
import {
  readVaultBalances,
  type RuntimeEnv,
  type VaultAssetBalance,
} from "./onchainState";
import { withOnchainPolicyState } from "./onchainState";

type JsonMap = Record<string, unknown>;

export type VaultBalancesSnapshot = {
  vaultAddress: string | null;
  chainId: number | null;
  asOf: string;
  nativeBalance: VaultAssetBalance | null;
  tokenBalances: VaultAssetBalance[];
  spendableUsd: number | null;
  sources: Array<{
    id: string;
    status: "live" | "configured" | "unavailable";
    detail: string;
  }>;
};

export type OpenPositionSnapshot = {
  positionId: string;
  protocol: string;
  asset: string;
  positionType: string;
  amount: {
    raw: string;
    formatted: string;
    decimals: number;
  };
  usdValue: number | null;
  rewards: Array<Record<string, unknown>>;
  health: {
    status: string;
    detail: string;
  };
  exitConstraints: string[];
};

export type PolicySurfaceSnapshot = {
  source: "onchain" | "draft" | "none";
  syncStatus: string;
  policyVersion: string | null;
  limits: {
    perUseUsd: number | null;
    dailyUsd: number | null;
    totalUsd: number | null;
    manualApprovalUsd: number | null;
    maxSlippageBps: number | null;
  };
  allowlists: {
    assets: string[];
    protocols: string[];
    targets: string[];
    selectors: string[];
  };
  validity: {
    validAfter: string | null;
    validUntil: string | null;
    isActiveNow: boolean;
  };
  domain: {
    policyDomain: "execution";
    grantAllowedDomains: string[];
    sessionAllowedDomains: string[];
  };
  usage: {
    executed24hUsd: number;
    executedTotalUsd: number;
    pendingUsd: number;
    executedCount: number;
    failedCount: number;
  };
  remainingBudget: {
    perUseUsd: number | null;
    dailyUsd: number | null;
    totalUsd: number | null;
  };
};

export type ExecutionReadinessSnapshot = {
  status: "ready" | "degraded" | "blocked";
  balance: {
    vaultAddress: string | null;
    nativeGasAsset: string;
    nativeGasBalanceFormatted: string | null;
    nativeGasReady: boolean;
    tokenBalances: VaultAssetBalance[];
    spendableUsd: number | null;
  };
  policy: {
    published: boolean;
    syncStatus: string;
    policyVersion: string | null;
    limits: PolicySurfaceSnapshot["limits"];
  };
  delegate: {
    expected: string | null;
    installed: string | null;
    ready: boolean;
  };
  guard: {
    expected: string | null;
    installed: string | null;
    ready: boolean;
  };
  module: {
    safeDeployed: boolean;
    vaultModuleEnabled: boolean;
    safe7579Enabled: boolean;
    fallbackHandlerReady: boolean;
  };
  grant: {
    id: string | null;
    status: string;
    expiresAt: string | null;
    executionAllowed: boolean;
  };
  session: {
    id: string | null;
    status: string;
    expiresAt: string | null;
    executionAllowed: boolean;
  };
  blockedReasons: string[];
  warnings: string[];
};

export type ActivityFeedSnapshot = {
  asOf: string;
  summary: {
    total: number;
    executed: number;
    blocked: number;
    pending: number;
    benchmarkLinked: number;
  };
  items: Array<{
    id: string;
    source: "automation_job" | "benchmark_job";
    type: string;
    status: string;
    occurredAt: string | null;
    executionDomain: string | null;
    amountUsd: number | null;
    txHash: string | null;
    failureReason: string | null;
    decisionId: string | null;
    benchmarkDecisionId: string | null;
    policyVersion: string | null;
    summary: string;
  }>;
};

export type StateCatalogSnapshot = {
  state: Record<string, unknown>;
  balances: VaultBalancesSnapshot;
  positions: OpenPositionSnapshot[];
  policySurface: PolicySurfaceSnapshot;
  readiness: ExecutionReadinessSnapshot;
  activityFeed: ActivityFeedSnapshot;
};

const asRecord = (value: unknown): JsonMap | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonMap) : null;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asBoolean = (value: unknown) => value === true;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : [];

const parseIsoMs = (value: unknown) => {
  const text = asString(value);
  if (!text) {
    return null;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const unixSecondsToIso = (value: unknown) => {
  const parsed = asNumber(value);
  if (parsed === null || parsed <= 0) {
    return null;
  }
  return new Date(parsed * 1000).toISOString();
};

const latestTimestamp = (record: JsonMap | null) =>
  asString(record?.confirmed_at) ??
  asString(record?.updated_at) ??
  asString(record?.created_at) ??
  null;

const extractIntentAmountUsd = (job: JsonMap | null) => {
  const payload = asRecord(job?.payload) ?? asRecord(job?.payload_json);
  const intent = asRecord(payload?.intent);
  return (
    asNumber(intent?.amountUsd) ??
    asNumber(payload?.amountUsd) ??
    asNumber(job?.amount_usd) ??
    null
  );
};

const isFailedJob = (job: JsonMap | null) => {
  const status = asString(job?.status)?.toLowerCase();
  return Boolean(
    asString(job?.failure_reason) ||
      status === "failed" ||
      status === "blocked" ||
      status === "rejected" ||
      status === "reverted"
  );
};

const isExecutedJob = (job: JsonMap | null) => {
  const status = asString(job?.status)?.toLowerCase();
  return Boolean(
    asString(job?.tx_hash) ||
      asString(job?.confirmed_at) ||
      status === "confirmed" ||
      status === "executed" ||
      status === "submitted" ||
      status === "success"
  );
};

const isPendingJob = (job: JsonMap | null) => !isFailedJob(job) && !isExecutedJob(job);

type UsageSummary = {
  executed24hUsd: number;
  executedTotalUsd: number;
  pendingUsd: number;
  executedCount: number;
  failedCount: number;
};

const summarizeSpend = (jobs: JsonMap[], asOfMs = Date.now()) => {
  const dayMs = 24 * 60 * 60 * 1000;
  return jobs.reduce(
    (acc: UsageSummary, job) => {
      const amountUsd = extractIntentAmountUsd(job) ?? 0;
      const occurredAt = parseIsoMs(latestTimestamp(job));
      if (isExecutedJob(job)) {
        acc.executedTotalUsd += amountUsd;
        acc.executedCount += 1;
        if (occurredAt !== null && asOfMs - occurredAt <= dayMs) {
          acc.executed24hUsd += amountUsd;
        }
      } else if (isPendingJob(job)) {
        acc.pendingUsd += amountUsd;
      } else if (isFailedJob(job)) {
        acc.failedCount += 1;
      }
      return acc;
    },
    {
      executed24hUsd: 0,
      executedTotalUsd: 0,
      pendingUsd: 0,
      executedCount: 0,
      failedCount: 0,
    } satisfies UsageSummary
  );
};

const normalizeAssetAllowlist = (value: unknown) =>
  asStringArray(value).map((entry) => entry.toUpperCase());

const normalizeAddressAllowlist = (value: unknown) =>
  asStringArray(value).map((entry) => entry.toLowerCase());

const uniqueText = (values: string[]) => [...new Set(values)];

const resolveVaultAddress = (state: Record<string, unknown>) =>
  asString(asRecord(state.vault)?.vault_address);

const resolveVaultId = (state: Record<string, unknown>) =>
  asString(asRecord(state.vault)?.vault_id);

const resolveChainId = (state: Record<string, unknown>, env: RuntimeEnv) =>
  asNumber(asRecord(state.vault)?.chain_id) ??
  asNumber(asRecord(state.account)?.chain_id) ??
  asNumber(env.NEURALRATE_CHAIN_ID) ??
  null;

const resolveExitConstraints = (state: Record<string, unknown>) => {
  const constraints: string[] = [];
  const grantDomains = asStringArray(asRecord(state.activeGrant)?.allowed_domains);
  const runtimeState = asRecord(state.runtimeState);
  const policySyncStatus = asString(state.policySyncStatus);

  if (!grantDomains.includes("execution")) {
    constraints.push("Execution domain is not present in the active automation grant.");
  }
  if (!asBoolean(runtimeState?.vaultModuleEnabled)) {
    constraints.push("Vault execution module is not enabled on the Safe.");
  }
  if (policySyncStatus && policySyncStatus !== "in_sync") {
    constraints.push(`Policy sync status is ${policySyncStatus}.`);
  }

  return constraints;
};

export async function buildVaultBalancesSnapshot(
  state: Record<string, unknown>,
  env: RuntimeEnv
): Promise<VaultBalancesSnapshot> {
  const vault = asRecord(state.vault);
  const vaultAddress = resolveVaultAddress(state);
  const chainId = resolveChainId(state, env);
  const asOf = new Date().toISOString();

  if (!vaultAddress) {
    return {
      vaultAddress: null,
      chainId,
      asOf,
      nativeBalance: null,
      tokenBalances: [],
      spendableUsd: null,
      sources: [{
        id: "vault_address",
        status: "unavailable",
        detail: "No vault address is recorded for the scoped owner yet.",
      }],
    };
  }

  const live = await readVaultBalances(vaultAddress, env);
  const spendableUsd = asNumber(vault?.balance_usd);
  const sources = [...live.sources];

  if (spendableUsd !== null) {
    sources.push({
      id: "vault_record_balance_usd",
      status: "configured",
      detail: "Approximate spendable USD carried from the vault record in the automation store.",
    });
  }

  return {
    vaultAddress,
    chainId,
    asOf,
    nativeBalance: live.nativeBalance,
    tokenBalances: live.tokenBalances,
    spendableUsd,
    sources,
  };
}

export function buildOpenPositionsSnapshot(
  state: Record<string, unknown>,
  balances: VaultBalancesSnapshot
): OpenPositionSnapshot[] {
  const constraints = resolveExitConstraints(state);
  const assets = [
    balances.nativeBalance,
    ...balances.tokenBalances,
  ].filter((entry): entry is VaultAssetBalance => Boolean(entry?.hasBalance));

  return assets.map((asset, index) => ({
    positionId: `${balances.vaultAddress ?? "vault"}:${asset.asset.toLowerCase()}:${index}`,
    protocol: "vault-wallet",
    asset: asset.asset,
    positionType: "wallet_balance",
    amount: {
      raw: asset.balanceRaw,
      formatted: asset.balanceFormatted,
      decimals: asset.decimals,
    },
    usdValue: asset.valuationUsd,
    rewards: [],
    health: {
      status: "unlevered",
      detail: "Wallet-held balance with no leveraged protocol exposure surfaced by the current worker read model.",
    },
    exitConstraints: constraints,
  }));
}

export function buildPolicySurfaceSnapshot(
  state: Record<string, unknown>,
  asOfMs = Date.now()
): PolicySurfaceSnapshot {
  const config = asRecord(state.config);
  const draftPolicy = asRecord(state.draftPolicy);
  const onchainPolicy = asRecord(state.onchainPolicy) ?? asRecord(state.activeOnchainPolicy);
  const activeGrant = asRecord(state.activeGrant);
  const activeSession = asRecord(state.activeMcpSession);
  const automationJobs = Array.isArray(state.automationJobs)
    ? state.automationJobs.map((entry) => asRecord(entry)).filter((entry): entry is JsonMap => Boolean(entry))
    : [];
  const usage = summarizeSpend(automationJobs, asOfMs);

  const source = onchainPolicy ? "onchain" : draftPolicy ? "draft" : "none";
  const perUseUsd = onchainPolicy
    ? asNumber(onchainPolicy.maxPerUse)
    : asNumber(draftPolicy?.maxPerUse ?? config?.max_action_usd);
  const dailyUsd = onchainPolicy
    ? asNumber(onchainPolicy.maxDaily)
    : asNumber(draftPolicy?.maxDaily ?? config?.max_daily_usd);
  const totalUsd = onchainPolicy
    ? asNumber(onchainPolicy.maxTotal)
    : asNumber(draftPolicy?.maxTotal ?? config?.max_automation_usd);
  const manualApprovalUsd = asNumber(config?.require_manual_above_usd);
  const maxSlippageBps = onchainPolicy
    ? asNumber(onchainPolicy.maxSlippageBps)
    : asNumber(draftPolicy?.maxSlippageBps ?? config?.max_slippage_bps);
  const validAfter = onchainPolicy ? unixSecondsToIso(onchainPolicy.validAfter) : null;
  const validUntil = onchainPolicy ? unixSecondsToIso(onchainPolicy.validUntil) : null;
  const validAfterMs = validAfter ? Date.parse(validAfter) : null;
  const validUntilMs = validUntil ? Date.parse(validUntil) : null;
  const isActiveNow =
    source === "onchain" &&
    (validAfterMs === null || validAfterMs <= asOfMs) &&
    (validUntilMs === null || validUntilMs >= asOfMs);

  return {
    source,
    syncStatus: asString(state.policySyncStatus) ?? "unknown",
    policyVersion:
      asString(onchainPolicy?.policyVersion) ??
      asString(draftPolicy?.policyVersion) ??
      asString(config?.policy_version),
    limits: {
      perUseUsd,
      dailyUsd,
      totalUsd,
      manualApprovalUsd,
      maxSlippageBps,
    },
    allowlists: {
      assets: uniqueText(
        normalizeAssetAllowlist(onchainPolicy?.allowedAssets ?? draftPolicy?.allowedAssets ?? config?.allowed_assets)
      ),
      protocols: uniqueText(
        normalizeAssetAllowlist(
          onchainPolicy?.allowedProtocols ?? draftPolicy?.allowedProtocols ?? config?.allowed_protocols
        )
      ),
      targets: uniqueText(normalizeAddressAllowlist(onchainPolicy?.allowedTargets)),
      selectors: uniqueText(normalizeAddressAllowlist(onchainPolicy?.allowedSelectors)),
    },
    validity: {
      validAfter,
      validUntil,
      isActiveNow,
    },
    domain: {
      policyDomain: "execution",
      grantAllowedDomains: uniqueText(asStringArray(activeGrant?.allowed_domains)),
      sessionAllowedDomains: uniqueText(asStringArray(activeSession?.allowed_domains)),
    },
    usage,
    remainingBudget: {
      perUseUsd,
      dailyUsd: dailyUsd === null ? null : Math.max(dailyUsd - usage.executed24hUsd, 0),
      totalUsd: totalUsd === null ? null : Math.max(totalUsd - usage.executedTotalUsd, 0),
    },
  };
}

export function buildExecutionReadinessSnapshot(
  state: Record<string, unknown>,
  balances: VaultBalancesSnapshot,
  policySurface: PolicySurfaceSnapshot
): ExecutionReadinessSnapshot {
  const runtimeState = asRecord(state.runtimeState);
  const activeGrant = asRecord(state.activeGrant);
  const activeSession = asRecord(state.activeMcpSession);
  const onchainPolicy = asRecord(state.onchainPolicy) ?? asRecord(state.activeOnchainPolicy);
  const aa = asRecord(state.aa);
  const nativeGas = balances.nativeBalance;

  const blockedReasons: string[] = [];
  const warnings: string[] = [];

  if (!balances.vaultAddress) {
    blockedReasons.push("Vault address is missing for this owner.");
  }
  if (!onchainPolicy) {
    blockedReasons.push("No active on-chain execution policy is published for this vault.");
  }
  if (!asBoolean(runtimeState?.safeDeployed)) {
    blockedReasons.push("Safe deployment is missing on-chain.");
  }
  if (!asBoolean(runtimeState?.vaultModuleEnabled)) {
    blockedReasons.push("Vault execution module is not enabled.");
  }
  if (!asBoolean(runtimeState?.safe7579Enabled)) {
    blockedReasons.push("Safe 7579 adapter is not enabled.");
  }
  if (!asBoolean(runtimeState?.fallbackHandlerReady)) {
    blockedReasons.push("Safe fallback handler is not wired to the expected 7579 adapter.");
  }
  if (!asBoolean(runtimeState?.moduleGuardReady)) {
    blockedReasons.push("Execution guard is not installed as the active module guard.");
  }
  if (!asBoolean(runtimeState?.delegateReady)) {
    blockedReasons.push("Expected delegate session signer is not installed on the validator.");
  }
  if (asString(activeGrant?.status) !== "active") {
    blockedReasons.push("Active automation grant is missing or not active.");
  } else if (!asStringArray(activeGrant?.allowed_domains).includes("execution")) {
    blockedReasons.push("Active automation grant does not include the execution domain.");
  }
  if (asString(activeSession?.status) !== "active") {
    blockedReasons.push("Active MCP session is missing or not active.");
  } else if (!asStringArray(activeSession?.allowed_domains).includes("execution")) {
    blockedReasons.push("Active MCP session does not include the execution domain.");
  }
  if (!nativeGas || !nativeGas.hasBalance) {
    blockedReasons.push("Vault has no native gas balance available for execution.");
  }

  if (policySurface.syncStatus !== "in_sync") {
    warnings.push(`Policy sync status is ${policySurface.syncStatus}.`);
  }
  if (
    balances.tokenBalances.length === 0 &&
    policySurface.allowlists.assets.some((asset) => asset !== "MNT")
  ) {
    warnings.push("Worker-side tracked ERC20 asset reads are not configured for every allowlisted execution asset.");
  }
  if (policySurface.usage.pendingUsd > 0) {
    warnings.push(`There is ${policySurface.usage.pendingUsd} USD of pending automation volume still in flight.`);
  }

  const status =
    blockedReasons.length > 0
      ? "blocked"
      : warnings.length > 0
        ? "degraded"
        : "ready";

  return {
    status,
    balance: {
      vaultAddress: balances.vaultAddress,
      nativeGasAsset: nativeGas?.asset ?? "MNT",
      nativeGasBalanceFormatted: nativeGas?.balanceFormatted ?? null,
      nativeGasReady: Boolean(nativeGas?.hasBalance),
      tokenBalances: balances.tokenBalances,
      spendableUsd: balances.spendableUsd,
    },
    policy: {
      published: Boolean(onchainPolicy),
      syncStatus: policySurface.syncStatus,
      policyVersion: policySurface.policyVersion,
      limits: policySurface.limits,
    },
    delegate: {
      expected: asString(aa?.agentSessionSignerAddress),
      installed: asString(runtimeState?.installedDelegate),
      ready: asBoolean(runtimeState?.delegateReady),
    },
    guard: {
      expected: asString(aa?.executionGuardContract),
      installed: asString(runtimeState?.moduleGuard),
      ready: asBoolean(runtimeState?.moduleGuardReady),
    },
    module: {
      safeDeployed: asBoolean(runtimeState?.safeDeployed),
      vaultModuleEnabled: asBoolean(runtimeState?.vaultModuleEnabled),
      safe7579Enabled: asBoolean(runtimeState?.safe7579Enabled),
      fallbackHandlerReady: asBoolean(runtimeState?.fallbackHandlerReady),
    },
    grant: {
      id: asString(activeGrant?.grant_id),
      status: asString(activeGrant?.status) ?? "missing",
      expiresAt: asString(activeGrant?.expires_at),
      executionAllowed: asStringArray(activeGrant?.allowed_domains).includes("execution"),
    },
    session: {
      id: asString(activeSession?.session_id),
      status: asString(activeSession?.status) ?? "missing",
      expiresAt: asString(activeSession?.expires_at),
      executionAllowed: asStringArray(activeSession?.allowed_domains).includes("execution"),
    },
    blockedReasons,
    warnings,
  };
}

export function buildActivityFeedSnapshot(
  state: Record<string, unknown>,
  asOfMs = Date.now()
): ActivityFeedSnapshot {
  const automationJobs = Array.isArray(state.automationJobs)
    ? state.automationJobs.map((entry) => asRecord(entry)).filter((entry): entry is JsonMap => Boolean(entry))
    : [];
  const benchmarkJobs = Array.isArray(state.benchmarkJobs)
    ? state.benchmarkJobs.map((entry) => asRecord(entry)).filter((entry): entry is JsonMap => Boolean(entry))
    : [];

  const items = [
    ...automationJobs.map((job) => {
      const amountUsd = extractIntentAmountUsd(job);
      const status = isFailedJob(job) ? "blocked" : isExecutedJob(job) ? "executed" : "pending";
      const occurredAt = latestTimestamp(job);
      return {
        id: asString(job.job_id) ?? crypto.randomUUID(),
        source: "automation_job" as const,
        type: asString(job.job_type) ?? "automation_job",
        status,
        occurredAt,
        executionDomain: asString(job.execution_domain),
        amountUsd,
        txHash: asString(job.tx_hash),
        failureReason: asString(job.failure_reason),
        decisionId: asString(job.decision_id),
        benchmarkDecisionId: null,
        policyVersion: asString(job.policy_version),
        summary:
          status === "blocked"
            ? `Automation ${asString(job.job_type) ?? "job"} blocked${amountUsd !== null ? ` at ${amountUsd} USD` : ""}.`
            : status === "executed"
              ? `Automation ${asString(job.job_type) ?? "job"} executed${amountUsd !== null ? ` at ${amountUsd} USD` : ""}.`
              : `Automation ${asString(job.job_type) ?? "job"} is pending.`,
      };
    }),
    ...benchmarkJobs.map((job) => {
      const status = isFailedJob(job) ? "blocked" : isExecutedJob(job) ? "executed" : "pending";
      return {
        id: asString(job.benchmark_job_id) ?? crypto.randomUUID(),
        source: "benchmark_job" as const,
        type: "benchmark_receipt",
        status,
        occurredAt: latestTimestamp(job),
        executionDomain: "benchmark",
        amountUsd: extractIntentAmountUsd(job),
        txHash: asString(job.tx_hash),
        failureReason: asString(job.failure_reason),
        decisionId: asString(job.decision_id),
        benchmarkDecisionId: asString(job.onchain_decision_id),
        policyVersion: asString(job.policy_version),
        summary:
          status === "blocked"
            ? `Benchmark receipt for decision ${asString(job.decision_id) ?? "unknown"} failed.`
            : status === "executed"
              ? `Benchmark receipt anchored for decision ${asString(job.decision_id) ?? "unknown"}.`
              : `Benchmark receipt for decision ${asString(job.decision_id) ?? "unknown"} is pending.`,
      };
    }),
  ].sort((left, right) => {
    const leftMs = left.occurredAt ? Date.parse(left.occurredAt) : 0;
    const rightMs = right.occurredAt ? Date.parse(right.occurredAt) : 0;
    return rightMs - leftMs;
  });

  return {
    asOf: new Date(asOfMs).toISOString(),
    summary: {
      total: items.length,
      executed: items.filter((item) => item.status === "executed").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      pending: items.filter((item) => item.status === "pending").length,
      benchmarkLinked: items.filter((item) => item.benchmarkDecisionId !== null).length,
    },
    items,
  };
}

export async function loadScopedStateCatalogSnapshot(
  automation: AutomationStore,
  env: RuntimeEnv,
  ownerEoa: string
): Promise<StateCatalogSnapshot> {
  const state = await withOnchainPolicyState(await automation.getAutomationState(ownerEoa), env);
  const balances = await buildVaultBalancesSnapshot(state, env);
  const positions = buildOpenPositionsSnapshot(state, balances);
  const policySurface = buildPolicySurfaceSnapshot(state);
  const readiness = buildExecutionReadinessSnapshot(state, balances, policySurface);
  const activityFeed = buildActivityFeedSnapshot(state);

  return {
    state,
    balances,
    positions,
    policySurface,
    readiness,
    activityFeed,
  };
}

export function isScopedVaultReference(
  snapshot: StateCatalogSnapshot,
  vaultRef: string
) {
  return [resolveVaultId(snapshot.state), resolveVaultAddress(snapshot.state), "current"]
    .filter((value): value is string => Boolean(value))
    .includes(vaultRef);
}

export function listScopedVaultReferences(snapshot: StateCatalogSnapshot) {
  return uniqueText(
    [resolveVaultId(snapshot.state), resolveVaultAddress(snapshot.state), "current"]
      .filter((value): value is string => Boolean(value))
  );
}

const snapshotToJson = (value: unknown) => JSON.stringify(value, null, 2);

export function buildPortfolioReviewPrompt(snapshot: StateCatalogSnapshot) {
  return {
    description: "Review the scoped vault portfolio with balances, open positions, and execution blockers.",
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text:
          "Review this NeuralRate vault portfolio. Focus on idle balances, position concentration, execution blockers, and safe next actions that stay within the current policy.\n\n" +
          snapshotToJson({
            balances: snapshot.balances,
            positions: snapshot.positions,
            readiness: snapshot.readiness,
          }),
      },
    }],
  };
}

export function buildExecutionReadinessPrompt(snapshot: StateCatalogSnapshot) {
  return {
    description: "Explain whether the scoped vault is execution-ready and what needs to be fixed if not.",
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text:
          "Explain whether this NeuralRate vault is ready for autonomous execution. Call out hard blockers first, then warnings, then the minimum remediation steps.\n\n" +
          snapshotToJson(snapshot.readiness),
      },
    }],
  };
}

export function buildWhyBlockedPrompt(snapshot: StateCatalogSnapshot) {
  return {
    description: "Explain why the scoped vault is blocked and tie each blocker to the relevant state surface.",
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text:
          "Explain why this NeuralRate vault is blocked. Reference policy, grant, session, module, guard, delegate, and gas conditions. Suggest the safest order to fix them.\n\n" +
          snapshotToJson({
            readiness: snapshot.readiness,
            policySurface: snapshot.policySurface,
            activityFeed: snapshot.activityFeed,
          }),
      },
    }],
  };
}
