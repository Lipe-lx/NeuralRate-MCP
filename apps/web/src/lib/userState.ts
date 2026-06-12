export interface DecisionRecord {
  id: number;
  decision_id: string;
  agent_address: string;
  requested_by: string;
  user_id: string | null;
  vault_id: string | null;
  policy_version: string | null;
  data_snapshot_hash: string | null;
  predicted_apy_bps: number;
  risk_adjusted_apy_bps: number | null;
  benchmark_rate_bps: number | null;
  risk_profile: string;
  objective: string | null;
  automation_mode: string | null;
  allocation_json: string | null;
  applied_constraints_json: string | null;
  rationale_json: string | null;
  settlement_horizon_hours: number;
  created_at: string;
  tx_hash: string | null;
  benchmark_status: "local" | "pending" | "onchain" | null;
  onchain_decision_id: string | null;
  automation_session_id: string | null;
  benchmark_job_id: string | null;
}

export interface UserProfile {
  user_id: string;
  owner_eoa: string;
  auth_strategy: string;
  external_wallet: string | null;
  embedded_wallet: string | null;
  display_name: string | null;
  onboarding_status: string;
}

export interface AgentConfig {
  user_id: string;
  owner_eoa: string;
  vault_id: string | null;
  objective: "preserve" | "income" | "growth";
  risk_profile: "low" | "medium" | "high";
  horizon_hours: number;
  automation_mode: "recommend-only" | "auto-within-limits";
  restriction_preset: "stable-only" | "blue-chip-defi" | "yield-maximizer" | "rwa-focused";
  allowed_assets: string[];
  denied_assets: string[];
  allowed_protocols: string[];
  denied_protocols: string[];
  max_protocol_weight_bps: number;
  max_asset_weight_bps: number;
  max_action_usd: number;
  max_daily_usd: number;
  max_automation_usd: number;
  max_slippage_bps: number;
  rebalance_cadence_hours: number;
  min_apy_bps: number;
  min_spread_over_tbill_bps: number;
  require_manual_above_usd: number;
  pause_on_risk_event: number;
  authorization_ttl_hours?: number;
  policy_version: string;
}

export interface UserVault {
  vault_id: string;
  user_id: string;
  owner_eoa: string;
  vault_address: string | null;
  vault_kind: string;
  vault_provider: string;
  agent_scope_wallet: string | null;
  chain_id: number;
  status: string;
  funding_status: string;
  automation_status: string;
  balance_usd: string;
  deposit_address: string | null;
  last_funding_intent: Record<string, unknown> | null;
  ownership_acknowledged_at: string | null;
}

export interface VaultPermission {
  permission_id: string;
  user_id: string;
  vault_id: string;
  owner_eoa: string;
  scope: "benchmark" | "execution";
  status: string;
  allowed_contracts: string[];
  allowed_selectors: string[];
  allowed_assets: string[];
  allowed_protocols: string[];
  spend_token: string | null;
  spend_limit_per_use: string | null;
  spend_limit_daily: string | null;
  spend_limit_total: string | null;
  usage_limit: number | null;
  valid_after: string | null;
  valid_until: string | null;
  human_summary: string | null;
}

export interface AutomationSession {
  session_id: string;
  policy_id: string;
  user_smart_account: string | null;
  agent_session_signer: string;
  session_status: string;
  permission_id: string | null;
  valid_after: string | null;
  valid_until: string | null;
  consent_message: string | null;
  consent_signature: string | null;
  consent_digest: string | null;
  consent_verified_at: string | null;
  grant_tx_hash: string | null;
}

export interface AutomationGrant {
  grant_id: string;
  owner_eoa: string;
  user_id: string;
  vault_id: string;
  vault_address: string;
  agent_subject: string;
  policy_version: string;
  allowed_domains: string[];
  nonce: string;
  signature: string;
  grant_message: string;
  issued_via: string | null;
  status: string;
  issued_at: string;
  expires_at: string;
  revoked_at: string | null;
  session_id: string | null;
}

export interface McpMutationSession {
  session_id: string;
  grant_id: string;
  owner_eoa: string;
  user_id: string;
  vault_id: string;
  vault_address: string;
  agent_subject: string;
  policy_version: string;
  allowed_domains: string[];
  session_token_hash: string;
  issued_via: string | null;
  status: string;
  issued_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface BenchmarkJob {
  benchmark_job_id: string;
  decision_id: string;
  status: string;
  failure_reason: string | null;
  tx_hash: string | null;
  onchain_decision_id: string | null;
  confirmed_at: string | null;
}

export interface AutomationJob {
  job_id: string;
  session_id: string | null;
  execution_domain: string | null;
  job_type: string;
  target_contract: string | null;
  target_selector: string | null;
  payload_json: string | null;
  status: string;
  tx_hash: string | null;
  confirmed_at: string | null;
  failure_reason: string | null;
  created_at: string | null;
}

export interface RuntimeTokenBalance {
  asset: string;
  kind: "native" | "erc20";
  address: string | null;
  decimals: number;
  balanceRaw: string;
  balanceFormatted: string;
  hasBalance: boolean;
  valuationUsd: number | null;
  valuationSource: string | null;
  readStatus: "live" | "cached" | "unavailable";
  asOf: string | null;
}

export interface AutomationState {
  ownerEoa: string;
  userId: string | null;
  profile: UserProfile | null;
  config: AgentConfig | null;
  vault: UserVault | null;
  permissions: VaultPermission[];
  activePermission: VaultPermission | null;
  sessions: AutomationSession[];
  activeSession: AutomationSession | null;
  grants: AutomationGrant[];
  activeGrant: AutomationGrant | null;
  mcpSessions: McpMutationSession[];
  activeMcpSession: McpMutationSession | null;
  automationJobs: AutomationJob[];
  benchmarkJobs: BenchmarkJob[];
  automationReady: boolean;
  draftPolicy?: AgentConfig | null;
  activeOnchainPolicy?: {
    policyId: string;
    ownerEoa: string;
    vaultAddress: string;
    delegate: string;
    maxPerUse: string;
    maxDaily: string;
    maxTotal: string;
    validAfter: number;
    validUntil: number;
    maxSlippageBps: number;
    requireSnapshot: boolean;
    hasTargetAllowlist: boolean;
    hasSelectorAllowlist: boolean;
    policyVersion: string;
    allowedAssets: string[];
    allowedProtocols: string[];
    allowedTargets: string[];
    allowedSelectors: string[];
  } | null;
  policySyncStatus?: "not_published" | "in_sync" | "drifted" | "pending_publish" | "pending_revoke" | null;
  runtimeState?: {
    safeDeployed?: boolean;
    vaultModuleEnabled?: boolean;
    safe7579Enabled?: boolean;
    fallbackReady?: boolean;
    fallbackHandlerReady?: boolean;
    moduleGuardReady?: boolean;
    trustedModuleReady?: boolean;
    trustedSafeModuleReady?: boolean;
    trustedSafeModule?: string | null;
    delegateGasReady?: boolean;
    delegateGasBalanceFormatted?: string | null;
    paymasterConfigured?: boolean;
    paymasterReady?: boolean;
    gasPayer?: string | null;
    delegateReady?: boolean;
    installedDelegate?: string | null;
    nativeBalanceWei?: string | null;
    nativeBalanceFormatted?: string | null;
    nativeAssetSymbol?: string | null;
    hasNativeBalance?: boolean;
    tokenBalances?: RuntimeTokenBalance[];
    hasTokenBalance?: boolean;
    lastCheckedAt?: string | null;
  } | null;
  onchainPolicy?: {
    policyId: string;
    ownerEoa: string;
    vaultAddress: string;
    delegate: string;
    maxPerUse: string;
    maxDaily: string;
    maxTotal: string;
    validAfter: number;
    validUntil: number;
    maxSlippageBps: number;
    requireSnapshot: boolean;
    hasTargetAllowlist: boolean;
    hasSelectorAllowlist: boolean;
    policyVersion: string;
  } | null;
  aa?: {
    policyRegistryContract: string | null;
    executionGuardContract: string | null;
    safe4337ModuleAddress: string | null;
    safe7579AdapterAddress: string | null;
    safe7579LaunchpadAddress: string | null;
    delegateValidatorAddress: string | null;
    entryPointAddress: string | null;
    authorityModel: string;
  } | null;
  _readyDiagnostics?: Record<string, boolean> | null;
}

const parsePositiveWei = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  try {
    return BigInt(value) > 0n;
  } catch {
    return false;
  }
};

const parsePositiveDecimal = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value !== "string") {
    return false;
  }

  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0;
};

export const hasRuntimeNativeDeposit = (state: Pick<AutomationState, "runtimeState"> | null | undefined) =>
  Boolean(state?.runtimeState?.hasNativeBalance) ||
  parsePositiveWei(state?.runtimeState?.nativeBalanceWei) ||
  parsePositiveDecimal(state?.runtimeState?.nativeBalanceFormatted);

export const hasRuntimeTokenDeposit = (state: Pick<AutomationState, "runtimeState"> | null | undefined) =>
  Boolean(state?.runtimeState?.hasTokenBalance) ||
  Boolean(state?.runtimeState?.tokenBalances?.some((entry) =>
    entry.hasBalance ||
    parsePositiveWei(entry.balanceRaw) ||
    parsePositiveDecimal(entry.balanceFormatted)
  ));

export const hasDetectedVaultDeposit = (
  state: Pick<AutomationState, "runtimeState" | "vault"> | null | undefined,
) =>
  hasRuntimeNativeDeposit(state) ||
  hasRuntimeTokenDeposit(state) ||
  state?.vault?.funding_status === "deposit_detected";

const sameVaultAddress = (left: AutomationState | null | undefined, right: AutomationState | null | undefined) => {
  const leftAddress = left?.vault?.vault_address?.toLowerCase();
  const rightAddress = right?.vault?.vault_address?.toLowerCase();
  return Boolean(leftAddress && rightAddress && leftAddress === rightAddress);
};

export const mergeLiveFundingTelemetry = (
  incoming: AutomationState,
  current: AutomationState | null | undefined,
): AutomationState => {
  const incomingHasDeposit = hasDetectedVaultDeposit(incoming);
  const canReuseCurrentDeposit = sameVaultAddress(incoming, current) && hasDetectedVaultDeposit(current);

  if (!incomingHasDeposit && !canReuseCurrentDeposit) {
    return incoming;
  }

  const sourceRuntime = incomingHasDeposit ? incoming.runtimeState : current?.runtimeState;

  return {
    ...incoming,
    vault: incoming.vault
      ? {
          ...incoming.vault,
          funding_status: "deposit_detected",
        }
      : incoming.vault,
    runtimeState: {
      ...(incoming.runtimeState ?? {}),
      nativeBalanceWei: incoming.runtimeState?.nativeBalanceWei ?? sourceRuntime?.nativeBalanceWei ?? null,
      nativeBalanceFormatted: incoming.runtimeState?.nativeBalanceFormatted ?? sourceRuntime?.nativeBalanceFormatted ?? null,
      nativeAssetSymbol: incoming.runtimeState?.nativeAssetSymbol ?? sourceRuntime?.nativeAssetSymbol ?? null,
      hasNativeBalance: incoming.runtimeState?.hasNativeBalance ?? sourceRuntime?.hasNativeBalance ?? false,
      tokenBalances: incoming.runtimeState?.tokenBalances ?? sourceRuntime?.tokenBalances ?? [],
      hasTokenBalance: incoming.runtimeState?.hasTokenBalance ?? sourceRuntime?.hasTokenBalance ?? false,
      lastCheckedAt: incoming.runtimeState?.lastCheckedAt ?? sourceRuntime?.lastCheckedAt ?? null,
    },
  };
};

export const restrictionPresetOptions = [
  { value: "stable-only", label: "Stable Only" },
  { value: "blue-chip-defi", label: "Blue-Chip DeFi" },
  { value: "yield-maximizer", label: "Yield Maximizer" },
  { value: "rwa-focused", label: "RWA Focused" },
] as const;

export const objectiveOptions = [
  { value: "preserve", label: "Preserve" },
  { value: "income", label: "Income" },
  { value: "growth", label: "Growth" },
] as const;

export const automationModeOptions = [
  { value: "recommend-only", label: "Recommend Only" },
  { value: "auto-within-limits", label: "Auto up to Limits" },
] as const;

export const shouldAutoRefreshState = (
  _cachedState: AutomationState | null,
  hasSession: boolean
): boolean => {
  return hasSession;
};
