export type AutomationAccountInput = {
  ownerEoa: string;
  userSmartAccount?: string | null;
  chainId?: number;
  accountProvider?: string;
  accountKind?: string;
  deploymentStatus?: string;
  userId?: string | null;
  vaultId?: string | null;
};

export type UserBootstrapInput = {
  ownerEoa: string;
  externalWallet?: string | null;
  embeddedWallet?: string | null;
  authStrategy?: string | null;
  displayName?: string | null;
  privyUserId?: string | null;
  providerUserRef?: string | null;
  walletProvider?: string | null;
  vaultAddress?: string | null;
  vaultProvider?: string | null;
  vaultKind?: string | null;
  vaultStatus?: string | null;
  safeDeploymentStatus?: string | null;
  safeSaltNonce?: string | null;
  ownershipAcknowledgedAt?: string | null;
  chainId?: number;
};

export type UserProfileInput = {
  ownerEoa: string;
  userId?: string | null;
  authStrategy?: string | null;
  externalWallet?: string | null;
  embeddedWallet?: string | null;
  displayName?: string | null;
  onboardingStatus?: string | null;
  privyUserId?: string | null;
  providerUserRef?: string | null;
  walletProvider?: string | null;
};

export type UserAgentConfigInput = {
  ownerEoa: string;
  userId?: string | null;
  vaultId?: string | null;
  objective?: "preserve" | "income" | "growth";
  riskProfile?: "low" | "medium" | "high";
  horizonHours?: number;
  automationMode?: "recommend-only" | "auto-within-limits";
  restrictionPreset?: "stable-only" | "blue-chip-defi" | "yield-maximizer" | "rwa-focused";
  allowedAssets?: string[];
  deniedAssets?: string[];
  allowedProtocols?: string[];
  deniedProtocols?: string[];
  maxProtocolWeightBps?: number;
  maxAssetWeightBps?: number;
  maxActionUsd?: number;
  maxDailyUsd?: number;
  maxAutomationUsd?: number;
  maxSlippageBps?: number;
  rebalanceCadenceHours?: number;
  minApyBps?: number;
  minSpreadOverTbillBps?: number;
  requireManualAboveUsd?: number;
  pauseOnRiskEvent?: boolean;
  policyVersion?: string;
};

export type UserVaultInput = {
  ownerEoa: string;
  userId?: string | null;
  vaultId?: string | null;
  vaultAddress?: string | null;
  vaultKind?: string | null;
  vaultProvider?: string | null;
  agentScopeWallet?: string | null;
  safeDeploymentStatus?: string | null;
  safeSaltNonce?: string | null;
  providerVaultRef?: string | null;
  chainId?: number;
  status?: string;
  fundingStatus?: string;
  automationStatus?: string;
  balanceUsd?: string | null;
  depositAddress?: string | null;
  lastFundingIntent?: Record<string, unknown> | null;
  ownershipAcknowledgedAt?: string | null;
};

export type VaultFundingIntentInput = {
  ownerEoa: string;
  amountUsd?: number | null;
  source?: string | null;
};

export type VaultPermissionInput = {
  permissionId: string;
  ownerEoa: string;
  userId?: string | null;
  vaultId?: string | null;
  scope?: "benchmark" | "execution";
  status?: string;
  allowedContracts?: string[];
  allowedSelectors?: string[];
  allowedAssets?: string[];
  allowedProtocols?: string[];
  spendToken?: string | null;
  spendLimitPerUse?: string | null;
  spendLimitDaily?: string | null;
  spendLimitTotal?: string | null;
  usageLimit?: number | null;
  validAfter?: string | null;
  validUntil?: string | null;
  humanSummary?: string | null;
  providerPermissionRef?: string | null;
  turnkeySignerRef?: string | null;
  rawPolicy?: Record<string, unknown>;
};

export type AutomationPolicyInput = {
  policyId: string;
  ownerEoa: string;
  userSmartAccount?: string | null;
  chainId?: number;
  policyVersion: string;
  domain: "benchmark" | "execution";
  status?: string;
  allowedContracts?: string[];
  allowedSelectors?: string[];
  allowedAssets?: string[];
  allowedProtocols?: string[];
  spendToken?: string | null;
  spendLimitPerUse?: string | null;
  spendLimitDaily?: string | null;
  spendLimitTotal?: string | null;
  usageLimit?: number | null;
  validAfter?: string | null;
  validUntil?: string | null;
  humanSummary?: string | null;
  rawPolicy?: Record<string, unknown>;
  userId?: string | null;
  vaultId?: string | null;
};

export type AutomationSessionInput = {
  sessionId: string;
  policyId: string;
  ownerEoa: string;
  userSmartAccount?: string | null;
  agentSessionSigner: string;
  chainId?: number;
  sessionStatus?: string;
  grantTxHash?: string | null;
  revokeTxHash?: string | null;
  permissionId?: string | null;
  sessionDetails?: unknown;
  validAfter?: string | null;
  validUntil?: string | null;
  revokedAt?: string | null;
  providerSessionRef?: string | null;
  providerPermissionRef?: string | null;
  consentMessage?: string | null;
  consentSignature?: string | null;
  consentDigest?: string | null;
  consentVerifiedAt?: string | null;
  turnkeySignerRef?: string | null;
  userId?: string | null;
  vaultId?: string | null;
  policyVersion?: string | null;
};

export type AutomationJobInput = {
  jobId: string;
  sessionId?: string | null;
  ownerEoa?: string | null;
  userSmartAccount?: string | null;
  executionDomain?: "benchmark" | "execution";
  jobType: string;
  targetContract?: string | null;
  targetSelector?: string | null;
  payload?: Record<string, unknown>;
  status?: string;
  txHash?: string | null;
  confirmedAt?: string | null;
  failureReason?: string | null;
  providerJobRef?: string | null;
  userId?: string | null;
  vaultId?: string | null;
  policyVersion?: string | null;
};

export type BenchmarkJobInput = {
  benchmarkJobId: string;
  decisionId: string;
  ownerEoa?: string | null;
  agentSmartWallet?: string | null;
  sessionId?: string | null;
  status?: string;
  txHash?: string | null;
  onchainDecisionId?: string | null;
  confirmedAt?: string | null;
  dataSnapshotHash?: string | null;
  payload?: Record<string, unknown>;
  failureReason?: string | null;
  providerJobRef?: string | null;
  userId?: string | null;
  vaultId?: string | null;
  policyVersion?: string | null;
};

export type AutomationGrantInput = {
  grantId: string;
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  allowedDomains: string[];
  nonce: string;
  signature: string;
  grantMessage: string;
  issuedVia?: string | null;
  status?: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  sessionId?: string | null;
};

export type McpMutationSessionInput = {
  sessionId: string;
  grantId: string;
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  allowedDomains: string[];
  sessionTokenHash: string;
  issuedVia?: string | null;
  status?: string;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
};

type DbRecord = Record<string, unknown>;
type NormalizedRecord = DbRecord & {
  allowed_contracts: string[];
  allowed_selectors: string[];
  allowed_assets: string[];
  denied_assets: string[];
  allowed_protocols: string[];
  denied_protocols: string[];
  allowed_domains: string[];
  raw_policy: Record<string, unknown>;
  session_details: unknown;
  payload: Record<string, unknown>;
  last_funding_intent: Record<string, unknown> | null;
  applied_constraints: Record<string, unknown>;
  rationale: Record<string, unknown>;
};

const asJson = <T>(value: unknown, fallback: T): T => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
};

const normalizeAddress = (value?: string | null) => (value ? value.toLowerCase() : null);
const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const normalizeRecord = (record: DbRecord | null): NormalizedRecord | null => {
  if (!record) {
    return null;
  }

  return {
    ...record,
    allowed_contracts: asJson<string[]>(record.allowed_contracts_json, []),
    allowed_selectors: asJson<string[]>(record.allowed_selectors_json, []),
    allowed_assets: asJson<string[]>(record.allowed_assets_json, []),
    denied_assets: asJson<string[]>(record.denied_assets_json, []),
    allowed_protocols: asJson<string[]>(record.allowed_protocols_json, []),
    denied_protocols: asJson<string[]>(record.denied_protocols_json, []),
    allowed_domains: asJson<string[]>(record.allowed_domains_json, []),
    raw_policy: asJson<Record<string, unknown>>(record.raw_policy_json, {}),
    session_details: asJson<unknown>(record.session_details_json, null),
    payload: asJson<Record<string, unknown>>(record.payload_json, {}),
    last_funding_intent: asJson<Record<string, unknown> | null>(record.last_funding_intent_json, null),
    applied_constraints: asJson<Record<string, unknown>>(record.applied_constraints_json, {}),
    rationale: asJson<Record<string, unknown>>(record.rationale_json, {}),
  } as NormalizedRecord;
};

const formatDisplayName = (ownerEoa: string) => `Vault ${ownerEoa.slice(0, 6)}...${ownerEoa.slice(-4)}`;

const defaultAgentConfig = (input: { ownerEoa: string; userId: string; vaultId: string }) => ({
  ownerEoa: input.ownerEoa,
  userId: input.userId,
  vaultId: input.vaultId,
  objective: "income" as const,
  riskProfile: "medium" as const,
  horizonHours: 24,
  automationMode: "auto-within-limits" as const,
  restrictionPreset: "blue-chip-defi" as const,
  allowedAssets: [],
  deniedAssets: [],
  allowedProtocols: [],
  deniedProtocols: [],
  maxProtocolWeightBps: 5000,
  maxAssetWeightBps: 5000,
  maxActionUsd: 1000,
  maxDailyUsd: 2500,
  maxAutomationUsd: 10000,
  maxSlippageBps: 50,
  rebalanceCadenceHours: 24,
  minApyBps: 0,
  minSpreadOverTbillBps: 0,
  requireManualAboveUsd: 2500,
  pauseOnRiskEvent: true,
  policyVersion: "vault-v1",
});

export class AutomationStore {
  constructor(private db: D1Database, private defaultChainId = 5003) {}

  private async resolveIdentity(ownerEoa: string, userId?: string | null, vaultId?: string | null) {
    const normalizedOwner = ownerEoa.toLowerCase();
    const profile =
      userId ? await this.getUserProfileByUserId(userId) : await this.getUserProfile(normalizedOwner);
    const vault =
      vaultId
        ? await this.getVaultByVaultId(vaultId)
        : await this.getVault(normalizedOwner);

    return {
      ownerEoa: normalizedOwner,
      userId: userId ?? (profile?.user_id as string | undefined) ?? null,
      vaultId: vaultId ?? (vault?.vault_id as string | undefined) ?? null,
      profile,
      vault,
    };
  }

  async bootstrapUser(input: UserBootstrapInput) {
    const normalizedOwner = input.ownerEoa.toLowerCase();
    const existingProfile = await this.getUserProfile(normalizedOwner);
    const userId = (existingProfile?.user_id as string | undefined) ?? makeId("user");

    await this.upsertUserProfile({
      ownerEoa: normalizedOwner,
      userId,
      authStrategy: input.authStrategy ?? "passkey-embedded",
      externalWallet: input.externalWallet ?? normalizedOwner,
      embeddedWallet: input.embeddedWallet ?? null,
      displayName: input.displayName ?? formatDisplayName(normalizedOwner),
      onboardingStatus: input.vaultAddress ? "vault_ready" : "vault_pending",
      privyUserId: input.privyUserId ?? null,
      providerUserRef: input.providerUserRef ?? null,
      walletProvider: input.walletProvider ?? "privy",
    });

    const existingVault = await this.getVault(normalizedOwner);
    const vaultId = (existingVault?.vault_id as string | undefined) ?? makeId("vault");
    const normalizedVaultAddress = normalizeAddress(input.vaultAddress);
    const status = input.vaultStatus ?? (normalizedVaultAddress ? "predicted" : "provisioning");

    await this.upsertVault({
      ownerEoa: normalizedOwner,
      userId,
      vaultId,
      vaultAddress: normalizedVaultAddress,
      vaultProvider: input.vaultProvider ?? "safe",
      vaultKind: input.vaultKind ?? "dedicated-safe-vault",
      safeDeploymentStatus: input.safeDeploymentStatus ?? status,
      safeSaltNonce: input.safeSaltNonce ?? "49",
      providerVaultRef: normalizedVaultAddress ? `safe:${normalizedVaultAddress}` : null,
      chainId: input.chainId ?? this.defaultChainId,
      status,
      fundingStatus: normalizedVaultAddress ? "needs_funding" : "setup_required",
      automationStatus: "not_enabled",
      depositAddress: normalizedVaultAddress,
      ownershipAcknowledgedAt: input.ownershipAcknowledgedAt ?? undefined,
    });

    const existingConfig = await this.getAgentConfig(normalizedOwner);
    if (!existingConfig) {
      await this.upsertAgentConfig(defaultAgentConfig({ ownerEoa: normalizedOwner, userId, vaultId }));
    }

    if (normalizedVaultAddress) {
      await this.upsertAccount({
        ownerEoa: normalizedOwner,
        userSmartAccount: normalizedVaultAddress,
        chainId: input.chainId ?? this.defaultChainId,
        accountProvider: input.vaultProvider ?? "safe",
        accountKind: "dedicated-safe-vault",
        deploymentStatus: status,
        userId,
        vaultId,
      });
    }

    return this.getAutomationState(normalizedOwner);
  }

  async upsertUserProfile(input: UserProfileInput) {
    const userId = input.userId ?? makeId("user");
    await this.db
      .prepare(`
        INSERT INTO user_profiles (
          user_id, owner_eoa, auth_strategy, external_wallet, embedded_wallet, display_name, onboarding_status,
          privy_user_id, provider_user_ref, wallet_provider
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_eoa) DO UPDATE SET
          auth_strategy = excluded.auth_strategy,
          external_wallet = excluded.external_wallet,
          embedded_wallet = excluded.embedded_wallet,
          display_name = excluded.display_name,
          onboarding_status = excluded.onboarding_status,
          privy_user_id = excluded.privy_user_id,
          provider_user_ref = excluded.provider_user_ref,
          wallet_provider = excluded.wallet_provider,
          updated_at = datetime('now')
      `)
      .bind(
        userId,
        input.ownerEoa.toLowerCase(),
        input.authStrategy ?? "passkey-embedded",
        normalizeAddress(input.externalWallet) ?? input.ownerEoa.toLowerCase(),
        normalizeAddress(input.embeddedWallet),
        input.displayName ?? formatDisplayName(input.ownerEoa.toLowerCase()),
        input.onboardingStatus ?? "vault_pending",
        input.privyUserId ?? null,
        input.providerUserRef ?? null,
        input.walletProvider ?? "privy"
      )
      .run();

    return this.getUserProfile(input.ownerEoa);
  }

  async getUserProfile(ownerEoa: string) {
    const result = await this.db
      .prepare("SELECT * FROM user_profiles WHERE owner_eoa = ? LIMIT 1")
      .bind(ownerEoa.toLowerCase())
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async getUserProfileByUserId(userId: string) {
    const result = await this.db
      .prepare("SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async upsertVault(input: UserVaultInput) {
    const identity = await this.resolveIdentity(input.ownerEoa, input.userId, input.vaultId);
    const userId = input.userId ?? identity.userId ?? makeId("user");
    const vaultId = input.vaultId ?? identity.vaultId ?? makeId("vault");
    const normalizedVaultAddress = normalizeAddress(input.vaultAddress);
    const depositAddress = normalizeAddress(input.depositAddress) ?? normalizedVaultAddress;

    await this.db
      .prepare(`
        INSERT INTO user_vaults (
          vault_id, user_id, owner_eoa, vault_address, vault_kind, vault_provider, agent_scope_wallet, chain_id,
          status, funding_status, automation_status, balance_usd, deposit_address, last_funding_intent_json,
          safe_deployment_status, safe_salt_nonce, provider_vault_ref, safe_vault_address, ownership_acknowledged_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(vault_id) DO UPDATE SET
          user_id = excluded.user_id,
          owner_eoa = excluded.owner_eoa,
          vault_address = excluded.vault_address,
          vault_kind = excluded.vault_kind,
          vault_provider = excluded.vault_provider,
          agent_scope_wallet = excluded.agent_scope_wallet,
          chain_id = excluded.chain_id,
          status = excluded.status,
          funding_status = excluded.funding_status,
          automation_status = excluded.automation_status,
          balance_usd = excluded.balance_usd,
          deposit_address = excluded.deposit_address,
          last_funding_intent_json = excluded.last_funding_intent_json,
          safe_deployment_status = excluded.safe_deployment_status,
          safe_salt_nonce = excluded.safe_salt_nonce,
          provider_vault_ref = excluded.provider_vault_ref,
          safe_vault_address = excluded.safe_vault_address,
          ownership_acknowledged_at = COALESCE(excluded.ownership_acknowledged_at, user_vaults.ownership_acknowledged_at),
          updated_at = datetime('now')
      `)
      .bind(
        vaultId,
        userId,
        input.ownerEoa.toLowerCase(),
        normalizedVaultAddress,
        input.vaultKind ?? "dedicated-safe-vault",
        input.vaultProvider ?? "safe",
        normalizeAddress(input.agentScopeWallet),
        input.chainId ?? this.defaultChainId,
        input.status ?? (normalizedVaultAddress ? "predicted" : "provisioning"),
        input.fundingStatus ?? (normalizedVaultAddress ? "needs_funding" : "setup_required"),
        input.automationStatus ?? "not_enabled",
        input.balanceUsd ?? "0",
        depositAddress,
        input.lastFundingIntent ? JSON.stringify(input.lastFundingIntent) : null,
        input.safeDeploymentStatus ?? (normalizedVaultAddress ? "predicted" : "pending"),
        input.safeSaltNonce ?? "49",
        input.providerVaultRef ?? (normalizedVaultAddress ? `safe:${normalizedVaultAddress}` : null),
        normalizedVaultAddress,
        input.ownershipAcknowledgedAt ?? null
      )
      .run();

    return this.getVault(input.ownerEoa);
  }

  async getVault(ownerEoa: string) {
    const result = await this.db
      .prepare("SELECT * FROM user_vaults WHERE owner_eoa = ? ORDER BY created_at DESC, id DESC LIMIT 1")
      .bind(ownerEoa.toLowerCase())
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async getVaultByVaultId(vaultId: string) {
    const result = await this.db
      .prepare("SELECT * FROM user_vaults WHERE vault_id = ? LIMIT 1")
      .bind(vaultId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async createFundingIntent(input: VaultFundingIntentInput) {
    const vault = await this.getVault(input.ownerEoa);
    if (!vault) {
      throw new Error("Vault not found for owner.");
    }

    const intent = {
      amountUsd: input.amountUsd ?? 1000,
      source: input.source ?? "external-wallet",
      createdAt: new Date().toISOString(),
      depositAddress: vault.deposit_address ?? vault.vault_address ?? null,
    };

    await this.db
      .prepare(`
        UPDATE user_vaults
        SET last_funding_intent_json = ?, funding_status = ?, updated_at = datetime('now')
        WHERE vault_id = ?
      `)
      .bind(JSON.stringify(intent), "awaiting_deposit", vault.vault_id)
      .run();

    return this.getVault(input.ownerEoa);
  }

  async acknowledgeVaultOwnership(input: {
    ownerEoa: string;
    vaultId?: string | null;
    userId?: string | null;
  }) {
    const identity = await this.resolveIdentity(input.ownerEoa, input.userId, input.vaultId);
    if (!identity.vaultId) {
      throw new Error("Vault not found for owner.");
    }

    const acknowledgedAt = new Date().toISOString();
    await this.db
      .prepare(`
        UPDATE user_vaults
        SET ownership_acknowledged_at = COALESCE(ownership_acknowledged_at, ?), updated_at = datetime('now')
        WHERE vault_id = ?
      `)
      .bind(acknowledgedAt, identity.vaultId)
      .run();

    return this.getAutomationState(identity.ownerEoa);
  }

  async upsertAgentConfig(input: UserAgentConfigInput) {
    const identity = await this.resolveIdentity(input.ownerEoa, input.userId, input.vaultId);
    const userId = input.userId ?? identity.userId ?? makeId("user");
    const vaultId = input.vaultId ?? identity.vaultId ?? null;

    await this.db
      .prepare(`
        INSERT INTO user_agent_configs (
          user_id, owner_eoa, vault_id, objective, risk_profile, horizon_hours, automation_mode, restriction_preset,
          allowed_assets_json, denied_assets_json, allowed_protocols_json, denied_protocols_json,
          max_protocol_weight_bps, max_asset_weight_bps, max_action_usd, max_daily_usd, max_automation_usd,
          max_slippage_bps, rebalance_cadence_hours, min_apy_bps, min_spread_over_tbill_bps,
          require_manual_above_usd, pause_on_risk_event, policy_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          owner_eoa = excluded.owner_eoa,
          vault_id = excluded.vault_id,
          objective = excluded.objective,
          risk_profile = excluded.risk_profile,
          horizon_hours = excluded.horizon_hours,
          automation_mode = excluded.automation_mode,
          restriction_preset = excluded.restriction_preset,
          allowed_assets_json = excluded.allowed_assets_json,
          denied_assets_json = excluded.denied_assets_json,
          allowed_protocols_json = excluded.allowed_protocols_json,
          denied_protocols_json = excluded.denied_protocols_json,
          max_protocol_weight_bps = excluded.max_protocol_weight_bps,
          max_asset_weight_bps = excluded.max_asset_weight_bps,
          max_action_usd = excluded.max_action_usd,
          max_daily_usd = excluded.max_daily_usd,
          max_automation_usd = excluded.max_automation_usd,
          max_slippage_bps = excluded.max_slippage_bps,
          rebalance_cadence_hours = excluded.rebalance_cadence_hours,
          min_apy_bps = excluded.min_apy_bps,
          min_spread_over_tbill_bps = excluded.min_spread_over_tbill_bps,
          require_manual_above_usd = excluded.require_manual_above_usd,
          pause_on_risk_event = excluded.pause_on_risk_event,
          policy_version = excluded.policy_version,
          updated_at = datetime('now')
      `)
      .bind(
        userId,
        input.ownerEoa.toLowerCase(),
        vaultId,
        input.objective ?? "income",
        input.riskProfile ?? "medium",
        input.horizonHours ?? 24,
        input.automationMode ?? "auto-within-limits",
        input.restrictionPreset ?? "blue-chip-defi",
        JSON.stringify(input.allowedAssets ?? []),
        JSON.stringify(input.deniedAssets ?? []),
        JSON.stringify(input.allowedProtocols ?? []),
        JSON.stringify(input.deniedProtocols ?? []),
        input.maxProtocolWeightBps ?? 5000,
        input.maxAssetWeightBps ?? 5000,
        input.maxActionUsd ?? 1000,
        input.maxDailyUsd ?? 2500,
        input.maxAutomationUsd ?? 10000,
        input.maxSlippageBps ?? 50,
        input.rebalanceCadenceHours ?? 24,
        input.minApyBps ?? 0,
        input.minSpreadOverTbillBps ?? 0,
        input.requireManualAboveUsd ?? 2500,
        input.pauseOnRiskEvent === false ? 0 : 1,
        input.policyVersion ?? "vault-v1"
      )
      .run();

    return this.getAgentConfig(input.ownerEoa);
  }

  async getAgentConfig(ownerEoa: string) {
    const result = await this.db
      .prepare("SELECT * FROM user_agent_configs WHERE owner_eoa = ? LIMIT 1")
      .bind(ownerEoa.toLowerCase())
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async upsertVaultPermission(input: VaultPermissionInput) {
    const identity = await this.resolveIdentity(input.ownerEoa, input.userId, input.vaultId);
    const userId = input.userId ?? identity.userId;
    const vaultId = input.vaultId ?? identity.vaultId;

    if (!userId || !vaultId) {
      throw new Error("Cannot persist vault permission before user/vault bootstrap.");
    }

    await this.db
      .prepare(`
        INSERT INTO vault_permissions (
          permission_id, user_id, vault_id, owner_eoa, scope, status, allowed_contracts_json, allowed_selectors_json,
          allowed_assets_json, allowed_protocols_json, spend_token, spend_limit_per_use, spend_limit_daily,
          spend_limit_total, usage_limit, valid_after, valid_until, human_summary, raw_policy_json,
          provider_permission_ref, turnkey_signer_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(permission_id) DO UPDATE SET
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          owner_eoa = excluded.owner_eoa,
          scope = excluded.scope,
          status = excluded.status,
          allowed_contracts_json = excluded.allowed_contracts_json,
          allowed_selectors_json = excluded.allowed_selectors_json,
          allowed_assets_json = excluded.allowed_assets_json,
          allowed_protocols_json = excluded.allowed_protocols_json,
          spend_token = excluded.spend_token,
          spend_limit_per_use = excluded.spend_limit_per_use,
          spend_limit_daily = excluded.spend_limit_daily,
          spend_limit_total = excluded.spend_limit_total,
          usage_limit = excluded.usage_limit,
          valid_after = excluded.valid_after,
          valid_until = excluded.valid_until,
          human_summary = excluded.human_summary,
          raw_policy_json = excluded.raw_policy_json,
          provider_permission_ref = excluded.provider_permission_ref,
          turnkey_signer_ref = excluded.turnkey_signer_ref,
          updated_at = datetime('now')
      `)
      .bind(
        input.permissionId,
        userId,
        vaultId,
        input.ownerEoa.toLowerCase(),
        input.scope ?? "execution",
        input.status ?? "draft",
        JSON.stringify(input.allowedContracts ?? []),
        JSON.stringify(input.allowedSelectors ?? []),
        JSON.stringify(input.allowedAssets ?? []),
        JSON.stringify(input.allowedProtocols ?? []),
        input.spendToken ?? null,
        input.spendLimitPerUse ?? null,
        input.spendLimitDaily ?? null,
        input.spendLimitTotal ?? null,
        input.usageLimit ?? null,
        input.validAfter ?? null,
        input.validUntil ?? null,
        input.humanSummary ?? null,
        JSON.stringify(input.rawPolicy ?? {}),
        input.providerPermissionRef ?? null,
        input.turnkeySignerRef ?? null
      )
      .run();

    return this.getVaultPermission(input.permissionId);
  }

  async getVaultPermission(permissionId: string) {
    const result = await this.db
      .prepare("SELECT * FROM vault_permissions WHERE permission_id = ? LIMIT 1")
      .bind(permissionId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listVaultPermissions(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM vault_permissions WHERE owner_eoa = ? ORDER BY created_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async upsertAccount(input: AutomationAccountInput) {
    await this.db
      .prepare(`
        INSERT INTO user_accounts (
          owner_eoa, user_smart_account, chain_id, account_provider, account_kind, deployment_status
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_eoa) DO UPDATE SET
          user_smart_account = excluded.user_smart_account,
          chain_id = excluded.chain_id,
          account_provider = excluded.account_provider,
          account_kind = excluded.account_kind,
          deployment_status = excluded.deployment_status,
          updated_at = datetime('now')
      `)
      .bind(
        input.ownerEoa.toLowerCase(),
        normalizeAddress(input.userSmartAccount),
        input.chainId ?? this.defaultChainId,
        input.accountProvider ?? "safe",
        input.accountKind ?? "dedicated-safe-vault",
        input.deploymentStatus ?? "predicted"
      )
      .run();

    return this.getAccount(input.ownerEoa);
  }

  async getAccount(ownerEoa: string) {
    const result = await this.db
      .prepare("SELECT * FROM user_accounts WHERE owner_eoa = ? LIMIT 1")
      .bind(ownerEoa.toLowerCase())
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async upsertPolicy(input: AutomationPolicyInput) {
    const identity = await this.resolveIdentity(input.ownerEoa, input.userId, input.vaultId);
    const userId = input.userId ?? identity.userId;
    const vaultId = input.vaultId ?? identity.vaultId;

    await this.db
      .prepare(`
        INSERT INTO automation_policies (
          policy_id, owner_eoa, user_smart_account, chain_id, policy_version, domain, status,
          allowed_contracts_json, allowed_selectors_json, spend_token, spend_limit_per_use,
          spend_limit_daily, spend_limit_total, usage_limit, valid_after, valid_until, human_summary,
          raw_policy_json, user_id, vault_id, allowed_assets_json, allowed_protocols_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(policy_id) DO UPDATE SET
          owner_eoa = excluded.owner_eoa,
          user_smart_account = excluded.user_smart_account,
          chain_id = excluded.chain_id,
          policy_version = excluded.policy_version,
          domain = excluded.domain,
          status = excluded.status,
          allowed_contracts_json = excluded.allowed_contracts_json,
          allowed_selectors_json = excluded.allowed_selectors_json,
          spend_token = excluded.spend_token,
          spend_limit_per_use = excluded.spend_limit_per_use,
          spend_limit_daily = excluded.spend_limit_daily,
          spend_limit_total = excluded.spend_limit_total,
          usage_limit = excluded.usage_limit,
          valid_after = excluded.valid_after,
          valid_until = excluded.valid_until,
          human_summary = excluded.human_summary,
          raw_policy_json = excluded.raw_policy_json,
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          allowed_assets_json = excluded.allowed_assets_json,
          allowed_protocols_json = excluded.allowed_protocols_json,
          updated_at = datetime('now')
      `)
      .bind(
        input.policyId,
        input.ownerEoa.toLowerCase(),
        normalizeAddress(input.userSmartAccount),
        input.chainId ?? this.defaultChainId,
        input.policyVersion,
        input.domain,
        input.status ?? "draft",
        JSON.stringify(input.allowedContracts ?? []),
        JSON.stringify(input.allowedSelectors ?? []),
        input.spendToken ?? null,
        input.spendLimitPerUse ?? null,
        input.spendLimitDaily ?? null,
        input.spendLimitTotal ?? null,
        input.usageLimit ?? null,
        input.validAfter ?? null,
        input.validUntil ?? null,
        input.humanSummary ?? null,
        JSON.stringify(input.rawPolicy ?? {}),
        userId,
        vaultId,
        JSON.stringify(input.allowedAssets ?? []),
        JSON.stringify(input.allowedProtocols ?? [])
      )
      .run();

    if (userId && vaultId) {
      await this.upsertVaultPermission({
        permissionId: input.policyId,
        ownerEoa: input.ownerEoa,
        userId,
        vaultId,
        scope: input.domain,
        status: input.status ?? "draft",
        allowedContracts: input.allowedContracts,
        allowedSelectors: input.allowedSelectors,
        allowedAssets: input.allowedAssets,
        allowedProtocols: input.allowedProtocols,
        spendToken: input.spendToken,
        spendLimitPerUse: input.spendLimitPerUse,
        spendLimitDaily: input.spendLimitDaily,
        spendLimitTotal: input.spendLimitTotal,
        usageLimit: input.usageLimit,
        validAfter: input.validAfter,
        validUntil: input.validUntil,
        humanSummary: input.humanSummary,
        rawPolicy: input.rawPolicy,
      });
    }

    return this.getPolicy(input.policyId);
  }

  async getPolicy(policyId: string) {
    const result = await this.db
      .prepare("SELECT * FROM automation_policies WHERE policy_id = ? LIMIT 1")
      .bind(policyId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listPolicies(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM automation_policies WHERE owner_eoa = ? ORDER BY created_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async upsertSession(input: AutomationSessionInput) {
    const identity = await this.resolveIdentity(input.ownerEoa, input.userId, input.vaultId);
    const userId = input.userId ?? identity.userId;
    const vaultId = input.vaultId ?? identity.vaultId;

    await this.db
      .prepare(`
        INSERT INTO automation_sessions (
          session_id, policy_id, owner_eoa, user_smart_account, agent_session_signer, chain_id,
          session_status, grant_tx_hash, revoke_tx_hash, permission_id, session_details_json,
          valid_after, valid_until, revoked_at, user_id, vault_id, policy_version,
          provider_session_ref, provider_permission_ref, consent_message, consent_signature, consent_digest,
          consent_verified_at, turnkey_signer_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          policy_id = excluded.policy_id,
          owner_eoa = excluded.owner_eoa,
          user_smart_account = excluded.user_smart_account,
          agent_session_signer = excluded.agent_session_signer,
          chain_id = excluded.chain_id,
          session_status = excluded.session_status,
          grant_tx_hash = excluded.grant_tx_hash,
          revoke_tx_hash = excluded.revoke_tx_hash,
          permission_id = excluded.permission_id,
          session_details_json = excluded.session_details_json,
          valid_after = excluded.valid_after,
          valid_until = excluded.valid_until,
          revoked_at = excluded.revoked_at,
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          policy_version = excluded.policy_version,
          provider_session_ref = excluded.provider_session_ref,
          provider_permission_ref = excluded.provider_permission_ref,
          consent_message = excluded.consent_message,
          consent_signature = excluded.consent_signature,
          consent_digest = excluded.consent_digest,
          consent_verified_at = excluded.consent_verified_at,
          turnkey_signer_ref = excluded.turnkey_signer_ref,
          updated_at = datetime('now')
      `)
      .bind(
        input.sessionId,
        input.policyId,
        input.ownerEoa.toLowerCase(),
        normalizeAddress(input.userSmartAccount),
        input.agentSessionSigner.toLowerCase(),
        input.chainId ?? this.defaultChainId,
        input.sessionStatus ?? "pending_user",
        input.grantTxHash ?? null,
        input.revokeTxHash ?? null,
        input.permissionId ?? null,
        input.sessionDetails ? JSON.stringify(input.sessionDetails) : null,
        input.validAfter ?? null,
        input.validUntil ?? null,
        input.revokedAt ?? null,
        userId,
        vaultId,
        input.policyVersion ?? null,
        input.providerSessionRef ?? null,
        input.providerPermissionRef ?? null,
        input.consentMessage ?? null,
        input.consentSignature ?? null,
        input.consentDigest ?? null,
        input.consentVerifiedAt ?? null,
        input.turnkeySignerRef ?? null
      )
      .run();

    if (vaultId) {
      await this.db
        .prepare("UPDATE user_vaults SET automation_status = ?, updated_at = datetime('now') WHERE vault_id = ?")
        .bind(input.sessionStatus === "active" ? "enabled" : input.sessionStatus === "revoked" ? "revoked" : "pending", vaultId)
        .run();
    }

    return this.getSession(input.sessionId);
  }

  async getSession(sessionId: string) {
    const result = await this.db
      .prepare("SELECT * FROM automation_sessions WHERE session_id = ? LIMIT 1")
      .bind(sessionId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listSessions(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM automation_sessions WHERE owner_eoa = ? ORDER BY created_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async upsertAutomationGrant(input: AutomationGrantInput) {
    await this.db
      .prepare(`
        INSERT INTO automation_grants (
          grant_id, owner_eoa, user_id, vault_id, vault_address, agent_subject, policy_version,
          allowed_domains_json, nonce, signature, grant_message, issued_via, status,
          issued_at, expires_at, revoked_at, session_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(grant_id) DO UPDATE SET
          owner_eoa = excluded.owner_eoa,
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          vault_address = excluded.vault_address,
          agent_subject = excluded.agent_subject,
          policy_version = excluded.policy_version,
          allowed_domains_json = excluded.allowed_domains_json,
          nonce = excluded.nonce,
          signature = excluded.signature,
          grant_message = excluded.grant_message,
          issued_via = excluded.issued_via,
          status = excluded.status,
          issued_at = excluded.issued_at,
          expires_at = excluded.expires_at,
          revoked_at = excluded.revoked_at,
          session_id = excluded.session_id,
          updated_at = datetime('now')
      `)
      .bind(
        input.grantId,
        input.ownerEoa.toLowerCase(),
        input.userId,
        input.vaultId,
        normalizeAddress(input.vaultAddress),
        input.agentSubject,
        input.policyVersion,
        JSON.stringify(input.allowedDomains),
        input.nonce,
        input.signature,
        input.grantMessage,
        input.issuedVia ?? "web",
        input.status ?? "active",
        input.issuedAt,
        input.expiresAt,
        input.revokedAt ?? null,
        input.sessionId ?? null,
      )
      .run();

    return this.getAutomationGrant(input.grantId);
  }

  async getAutomationGrant(grantId: string) {
    const result = await this.db
      .prepare("SELECT * FROM automation_grants WHERE grant_id = ? LIMIT 1")
      .bind(grantId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async getActiveAutomationGrant(ownerEoa: string) {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(`
        SELECT * FROM automation_grants
        WHERE owner_eoa = ?
          AND status = 'active'
          AND revoked_at IS NULL
          AND expires_at >= ?
        ORDER BY issued_at DESC, id DESC
        LIMIT 1
      `)
      .bind(ownerEoa.toLowerCase(), now)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listAutomationGrants(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM automation_grants WHERE owner_eoa = ? ORDER BY issued_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async revokeAutomationGrant(grantId: string, revokedAt = new Date().toISOString()) {
    await this.db
      .prepare(`
        UPDATE automation_grants
        SET status = 'revoked', revoked_at = ?, updated_at = datetime('now')
        WHERE grant_id = ?
      `)
      .bind(revokedAt, grantId)
      .run();

    await this.db
      .prepare(`
        UPDATE mcp_mutation_sessions
        SET status = 'revoked', revoked_at = COALESCE(revoked_at, ?), updated_at = datetime('now')
        WHERE grant_id = ? AND status = 'active'
      `)
      .bind(revokedAt, grantId)
      .run();

    return this.getAutomationGrant(grantId);
  }

  async upsertMcpMutationSession(input: McpMutationSessionInput) {
    await this.db
      .prepare(`
        INSERT INTO mcp_mutation_sessions (
          session_id, grant_id, owner_eoa, user_id, vault_id, vault_address, agent_subject, policy_version,
          allowed_domains_json, session_token_hash, issued_via, status, issued_at, expires_at, last_used_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          grant_id = excluded.grant_id,
          owner_eoa = excluded.owner_eoa,
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          vault_address = excluded.vault_address,
          agent_subject = excluded.agent_subject,
          policy_version = excluded.policy_version,
          allowed_domains_json = excluded.allowed_domains_json,
          session_token_hash = excluded.session_token_hash,
          issued_via = excluded.issued_via,
          status = excluded.status,
          issued_at = excluded.issued_at,
          expires_at = excluded.expires_at,
          last_used_at = excluded.last_used_at,
          revoked_at = excluded.revoked_at,
          updated_at = datetime('now')
      `)
      .bind(
        input.sessionId,
        input.grantId,
        input.ownerEoa.toLowerCase(),
        input.userId,
        input.vaultId,
        normalizeAddress(input.vaultAddress),
        input.agentSubject,
        input.policyVersion,
        JSON.stringify(input.allowedDomains),
        input.sessionTokenHash,
        input.issuedVia ?? "web",
        input.status ?? "active",
        input.issuedAt,
        input.expiresAt,
        input.lastUsedAt ?? null,
        input.revokedAt ?? null,
      )
      .run();

    return this.getMcpMutationSession(input.sessionId);
  }

  async getMcpMutationSession(sessionId: string) {
    const result = await this.db
      .prepare("SELECT * FROM mcp_mutation_sessions WHERE session_id = ? LIMIT 1")
      .bind(sessionId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async getMcpMutationSessionByTokenHash(sessionTokenHash: string) {
    const result = await this.db
      .prepare("SELECT * FROM mcp_mutation_sessions WHERE session_token_hash = ? LIMIT 1")
      .bind(sessionTokenHash)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listMcpMutationSessions(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM mcp_mutation_sessions WHERE owner_eoa = ? ORDER BY issued_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async getActiveMcpMutationSession(ownerEoa: string) {
    const now = new Date().toISOString();
    const result = await this.db
      .prepare(`
        SELECT * FROM mcp_mutation_sessions
        WHERE owner_eoa = ?
          AND status = 'active'
          AND revoked_at IS NULL
          AND expires_at >= ?
        ORDER BY issued_at DESC, id DESC
        LIMIT 1
      `)
      .bind(ownerEoa.toLowerCase(), now)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async touchMcpMutationSession(sessionId: string, lastUsedAt = new Date().toISOString()) {
    await this.db
      .prepare(`
        UPDATE mcp_mutation_sessions
        SET last_used_at = ?, updated_at = datetime('now')
        WHERE session_id = ?
      `)
      .bind(lastUsedAt, sessionId)
      .run();

    return this.getMcpMutationSession(sessionId);
  }

  async revokeMcpMutationSession(sessionId: string, revokedAt = new Date().toISOString()) {
    await this.db
      .prepare(`
        UPDATE mcp_mutation_sessions
        SET status = 'revoked', revoked_at = ?, updated_at = datetime('now')
        WHERE session_id = ?
      `)
      .bind(revokedAt, sessionId)
      .run();

    return this.getMcpMutationSession(sessionId);
  }

  async upsertAutomationJob(input: AutomationJobInput) {
    const normalizedOwner = input.ownerEoa?.toLowerCase() ?? null;
    const identity = normalizedOwner ? await this.resolveIdentity(normalizedOwner, input.userId, input.vaultId) : null;
    const userId = input.userId ?? identity?.userId ?? null;
    const vaultId = input.vaultId ?? identity?.vaultId ?? null;

    await this.db
      .prepare(`
        INSERT INTO automation_jobs (
          job_id, session_id, owner_eoa, user_smart_account, execution_domain, job_type,
          target_contract, target_selector, payload_json, status, tx_hash, confirmed_at, failure_reason,
          user_id, vault_id, policy_version, provider_job_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(job_id) DO UPDATE SET
          session_id = excluded.session_id,
          owner_eoa = excluded.owner_eoa,
          user_smart_account = excluded.user_smart_account,
          execution_domain = excluded.execution_domain,
          job_type = excluded.job_type,
          target_contract = excluded.target_contract,
          target_selector = excluded.target_selector,
          payload_json = excluded.payload_json,
          status = excluded.status,
          tx_hash = excluded.tx_hash,
          confirmed_at = excluded.confirmed_at,
          failure_reason = excluded.failure_reason,
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          policy_version = excluded.policy_version,
          provider_job_ref = excluded.provider_job_ref,
          updated_at = datetime('now')
      `)
      .bind(
        input.jobId,
        input.sessionId ?? null,
        normalizedOwner,
        normalizeAddress(input.userSmartAccount),
        input.executionDomain ?? "execution",
        input.jobType,
        normalizeAddress(input.targetContract),
        input.targetSelector ?? null,
        JSON.stringify(input.payload ?? {}),
        input.status ?? "queued",
        input.txHash ?? null,
        input.confirmedAt ?? null,
        input.failureReason ?? null,
        userId,
        vaultId,
        input.policyVersion ?? null,
        input.providerJobRef ?? null
      )
      .run();

    return this.getAutomationJob(input.jobId);
  }

  async getAutomationJob(jobId: string) {
    const result = await this.db
      .prepare("SELECT * FROM automation_jobs WHERE job_id = ? LIMIT 1")
      .bind(jobId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listAutomationJobs(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM automation_jobs WHERE owner_eoa = ? ORDER BY created_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async upsertBenchmarkJob(input: BenchmarkJobInput) {
    const normalizedOwner = input.ownerEoa?.toLowerCase() ?? null;
    const identity = normalizedOwner ? await this.resolveIdentity(normalizedOwner, input.userId, input.vaultId) : null;
    const userId = input.userId ?? identity?.userId ?? null;
    const vaultId = input.vaultId ?? identity?.vaultId ?? null;

    await this.db
      .prepare(`
        INSERT INTO benchmark_jobs (
          benchmark_job_id, decision_id, owner_eoa, agent_smart_wallet, session_id, status,
          tx_hash, onchain_decision_id, confirmed_at, data_snapshot_hash, payload_json, failure_reason,
          user_id, vault_id, policy_version, provider_job_ref
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(benchmark_job_id) DO UPDATE SET
          decision_id = excluded.decision_id,
          owner_eoa = excluded.owner_eoa,
          agent_smart_wallet = excluded.agent_smart_wallet,
          session_id = excluded.session_id,
          status = excluded.status,
          tx_hash = excluded.tx_hash,
          onchain_decision_id = excluded.onchain_decision_id,
          confirmed_at = excluded.confirmed_at,
          data_snapshot_hash = excluded.data_snapshot_hash,
          payload_json = excluded.payload_json,
          failure_reason = excluded.failure_reason,
          user_id = excluded.user_id,
          vault_id = excluded.vault_id,
          policy_version = excluded.policy_version,
          provider_job_ref = excluded.provider_job_ref,
          updated_at = datetime('now')
      `)
      .bind(
        input.benchmarkJobId,
        input.decisionId,
        normalizedOwner,
        normalizeAddress(input.agentSmartWallet),
        input.sessionId ?? null,
        input.status ?? "queued",
        input.txHash ?? null,
        input.onchainDecisionId ?? null,
        input.confirmedAt ?? null,
        input.dataSnapshotHash ?? null,
        JSON.stringify(input.payload ?? {}),
        input.failureReason ?? null,
        userId,
        vaultId,
        input.policyVersion ?? null,
        input.providerJobRef ?? null
      )
      .run();

    await this.db
      .prepare(`
        UPDATE decisions
        SET benchmark_job_id = ?, automation_session_id = COALESCE(automation_session_id, ?), user_id = COALESCE(user_id, ?), vault_id = COALESCE(vault_id, ?), policy_version = COALESCE(policy_version, ?)
        WHERE decision_id = ?
      `)
      .bind(input.benchmarkJobId, input.sessionId ?? null, userId, vaultId, input.policyVersion ?? null, input.decisionId)
      .run();

    return this.getBenchmarkJob(input.benchmarkJobId);
  }

  async getBenchmarkJob(benchmarkJobId: string) {
    const result = await this.db
      .prepare("SELECT * FROM benchmark_jobs WHERE benchmark_job_id = ? LIMIT 1")
      .bind(benchmarkJobId)
      .first<DbRecord>();

    return normalizeRecord(result);
  }

  async listBenchmarkJobs(ownerEoa: string) {
    const { results } = await this.db
      .prepare("SELECT * FROM benchmark_jobs WHERE owner_eoa = ? ORDER BY created_at DESC, id DESC")
      .bind(ownerEoa.toLowerCase())
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async listBenchmarkHistory(ownerEoa: string, limit = 50) {
    const identity = await this.resolveIdentity(ownerEoa);
    const userId = identity.userId ?? "";
    const { results } = await this.db
      .prepare(`
        SELECT * FROM decisions
        WHERE requested_by = ? OR user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `)
      .bind(ownerEoa.toLowerCase(), userId, limit)
      .all<DbRecord>();

    return (results ?? []).map((record) => normalizeRecord(record));
  }

  async getAutomationState(ownerEoa: string) {
    const [
      profile,
      config,
      vault,
      account,
      permissions,
      policies,
      sessions,
      automationJobs,
      benchmarkJobs,
      grants,
      mcpSessions,
      activeGrant,
      activeMcpSession,
    ] = await Promise.all([
      this.getUserProfile(ownerEoa),
      this.getAgentConfig(ownerEoa),
      this.getVault(ownerEoa),
      this.getAccount(ownerEoa),
      this.listVaultPermissions(ownerEoa),
      this.listPolicies(ownerEoa),
      this.listSessions(ownerEoa),
      this.listAutomationJobs(ownerEoa),
      this.listBenchmarkJobs(ownerEoa),
      this.listAutomationGrants(ownerEoa),
      this.listMcpMutationSessions(ownerEoa),
      this.getActiveAutomationGrant(ownerEoa),
      this.getActiveMcpMutationSession(ownerEoa),
    ]);

    const activeSession =
      (sessions as Array<Record<string, unknown> | null>).find((session) => session?.session_status === "active") ??
      (sessions as Array<Record<string, unknown> | null>).find((session) => session?.session_status === "pending_user") ??
      null;

    const activePermission =
      (permissions as Array<Record<string, unknown> | null>).find((permission) => permission?.status === "active") ??
      (permissions as Array<Record<string, unknown> | null>).find((permission) => permission?.status === "draft") ??
      null;

    return {
      ownerEoa: ownerEoa.toLowerCase(),
      userId: profile?.user_id ?? null,
      profile,
      config,
      vault,
      account,
      permissions,
      activePermission,
      policies,
      sessions,
      activeSession,
      automationJobs,
      benchmarkJobs,
      grants,
      activeGrant,
      mcpSessions,
      activeMcpSession,
      automationReady: Boolean(vault?.vault_id && config?.user_id && activeGrant?.grant_id && activeMcpSession?.session_id),
    };
  }
}
