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
}

export interface BenchmarkJob {
  benchmark_job_id: string;
  decision_id: string;
  status: string;
  failure_reason: string | null;
  tx_hash: string | null;
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
  benchmarkJobs: BenchmarkJob[];
  automationReady: boolean;
}

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
