import React from "react";
import { DEMO_TARGET_ASSET, MANTLE_EXPLORER_BASE_URL } from "../config";
import { hasDetectedVaultDeposit, type AutomationState } from "../lib/userState";

type Props = {
  state: AutomationState | null;
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);

const formatCount = (value: number) => new Intl.NumberFormat("en-US").format(value);
const formatTokenBalance = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value > 0 && value < 1 ? 4 : 2,
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const parseNumeric = (value: string | number | null | undefined) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const humanize = (value: string | null | undefined) =>
  value
    ? value
        .split(/[:_-]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Not available";

const truncate = (value: string | null | undefined) =>
  value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "n/a";

const parsePayloadJson = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const MetricCard: React.FC<{
  eyebrow: string;
  value: string;
  note: string;
  accent?: boolean;
}> = ({ eyebrow, value, note, accent = false }) => (
  <div className={`vault-metric-card${accent ? " accent" : ""}`}>
    <div className="vault-metric-eyebrow">{eyebrow}</div>
    <div className="vault-metric-value">{value}</div>
    <div className="vault-metric-note">{note}</div>
  </div>
);

const VaultTelemetryPanel: React.FC<Props> = ({ state }) => {
  const vault = state?.vault;
  const config = state?.config;
  const session = state?.activeSession;
  const activeGrant = state?.activeGrant;
  const activeMcpSession = state?.activeMcpSession;
  const activePermission = state?.activePermission;
  const managedValueUsd = parseNumeric(vault?.balance_usd);
  const liveNativeBalance = parseNumeric(state?.runtimeState?.nativeBalanceFormatted);
  const nativeAssetSymbol = state?.runtimeState?.nativeAssetSymbol ?? DEMO_TARGET_ASSET;
  const tokenBalances = state?.runtimeState?.tokenBalances ?? [];
  const visibleTokenBalances = tokenBalances.filter((entry) =>
    entry.hasBalance || parseNumeric(entry.balanceFormatted) > 0
  );
  const primaryTokenBalance = visibleTokenBalances[0] ?? null;
  const hasOnchainDeposit = hasDetectedVaultDeposit(state);
  const allowedAssets = activePermission?.allowed_assets?.length
    ? activePermission.allowed_assets
    : (config?.allowed_assets ?? []);
  const allowedProtocols = activePermission?.allowed_protocols?.length
    ? activePermission.allowed_protocols
    : (config?.allowed_protocols ?? []);
  const tokensInScope = Array.from(
    new Set([
      ...allowedAssets,
      ...(activePermission?.spend_token ? [activePermission.spend_token] : []),
    ]),
  );
  const dailyLimitUsd = parseNumeric(activePermission?.spend_limit_daily ?? config?.max_daily_usd);
  const perActionUsd = parseNumeric(activePermission?.spend_limit_per_use ?? config?.max_action_usd);
  const automationBudgetUsd = parseNumeric(activePermission?.spend_limit_total ?? config?.max_automation_usd);
  const manualApprovalUsd = parseNumeric(config?.require_manual_above_usd);
  const sessionWindowEnd =
    activeMcpSession?.expires_at ??
    activeGrant?.expires_at ??
    session?.valid_until ??
    activePermission?.valid_until ??
    null;
  const usageLimit = activePermission?.usage_limit ?? null;
  const budgetCoverage = automationBudgetUsd > 0 ? Math.min((managedValueUsd / automationBudgetUsd) * 100, 100) : 0;
  const automationStatus = humanize(
    activeGrant?.status ??
    activeMcpSession?.status ??
    session?.session_status ??
    vault?.automation_status ??
    "inactive",
  );
  const fundingStatus = hasOnchainDeposit ? "Deposit detected" : humanize(vault?.funding_status ?? "not-created");
  const policyPreset = humanize(config?.restriction_preset ?? "not-set");
  const riskProfile = humanize(config?.risk_profile ?? "medium");
  const consentRecordedAt = activeGrant?.issued_at ?? session?.consent_verified_at ?? null;
  const consentDigest = activeGrant?.grant_id ?? session?.consent_digest ?? session?.permission_id ?? null;
  const onchainGrantStatus = activeGrant?.status === "active" ? "Granted" : session?.grant_tx_hash ? "Executed" : "Not issued";
  const latestJobs = (state?.automationJobs ?? []).slice(0, 3);
  const managedCapitalValue = managedValueUsd > 0
    ? formatUsd(managedValueUsd)
    : primaryTokenBalance
      ? `${formatTokenBalance(parseNumeric(primaryTokenBalance.balanceFormatted))} ${primaryTokenBalance.asset}`
    : hasOnchainDeposit
      ? `${formatTokenBalance(liveNativeBalance)} ${nativeAssetSymbol}`
      : formatUsd(0);
  const managedCapitalNote = managedValueUsd > 0
    ? "Current balance administered inside this dedicated Safe vault."
    : primaryTokenBalance
      ? `${primaryTokenBalance.asset} detected inside this dedicated Safe vault.`
    : hasOnchainDeposit
      ? `On-chain ${nativeAssetSymbol} balance detected inside this dedicated Safe vault.`
      : "Current balance administered inside this dedicated Safe vault.";
  const budgetCaption = automationBudgetUsd > 0
    ? managedValueUsd > 0
      ? `Policy ceiling ${formatUsd(automationBudgetUsd)} • ${Math.round(budgetCoverage)}% currently represented`
      : hasOnchainDeposit
        ? `Policy ceiling ${formatUsd(automationBudgetUsd)} • on-chain funds detected, USD normalization pending`
        : `Policy ceiling ${formatUsd(automationBudgetUsd)}`
    : `Policy ceiling ${formatUsd(automationBudgetUsd)}`;
  const liveBalanceLabel = [
    liveNativeBalance > 0 ? `${formatTokenBalance(liveNativeBalance)} ${nativeAssetSymbol}` : null,
    ...visibleTokenBalances.map((entry) => `${formatTokenBalance(parseNumeric(entry.balanceFormatted))} ${entry.asset}`),
  ].filter(Boolean).join(" · ");

  return (
    <section className="glass-panel animate-enter vault-panel">
      <div className="vault-telemetry-layout">
        <div className="vault-swiss-kicker">Telemetry</div>
        <div className="vault-telemetry-top">
          <div className="vault-hero-card">
            <div className="vault-metric-eyebrow">Managed Capital</div>
            <div className="vault-hero-value">{managedCapitalValue}</div>
            <div className="vault-hero-note">{managedCapitalNote}</div>
            <div className="vault-status-strip">
              <span>{fundingStatus}</span>
              <span>{automationStatus}</span>
            </div>
            <div className="vault-budget-rail">
              <div className="vault-budget-rail-fill" style={{ width: `${budgetCoverage}%` }} />
            </div>
            <div className="vault-budget-caption">{budgetCaption}</div>
          </div>

          <div className="vault-metric-grid vault-metric-grid-top">
            <MetricCard
              eyebrow="Tokens In Scope"
              value={formatCount(tokensInScope.length)}
              note={tokensInScope.length ? tokensInScope.slice(0, 3).join(" · ") : "No token policy set yet"}
              accent
            />
            <MetricCard
              eyebrow="Protocols Open"
              value={formatCount(allowedProtocols.length)}
              note={allowedProtocols.length ? allowedProtocols.slice(0, 2).join(" · ") : policyPreset}
            />
            <MetricCard
              eyebrow="Daily Limit"
              value={formatUsd(dailyLimitUsd)}
              note="Agent throughput allowed per 24h"
            />
            <MetricCard
              eyebrow="Per Action"
              value={formatUsd(perActionUsd)}
              note="Maximum amount per autonomous action"
            />
          </div>
        </div>

        <div className="vault-info-grid vault-info-grid-wide">
          <div className="vault-info-card">
            <div className="vault-swiss-kicker">Policy Envelope</div>
            <div className="vault-info-row">
              <span>Total automation budget</span>
              <strong>{formatUsd(automationBudgetUsd)}</strong>
            </div>
            <div className="vault-info-row">
              <span>Manual approval threshold</span>
              <strong>{formatUsd(manualApprovalUsd)}</strong>
            </div>
            <div className="vault-info-row">
              <span>Risk profile</span>
              <strong>{riskProfile}</strong>
            </div>
          </div>

          <div className="vault-info-card">
            <div className="vault-swiss-kicker">Session Window</div>
            <div className="vault-info-row">
              <span>Valid until</span>
              <strong>{formatDateTime(sessionWindowEnd)}</strong>
            </div>
            <div className="vault-info-row">
              <span>Usage limit</span>
              <strong>{usageLimit ? formatCount(usageLimit) : "Not issued"}</strong>
            </div>
            <div className="vault-info-row">
              <span>Deposit model</span>
              <strong>Direct on-chain</strong>
            </div>
            <div className="vault-info-row">
              <span>Live vault balance</span>
              <strong>{liveBalanceLabel || (hasOnchainDeposit ? "Funds detected" : "Awaiting on-chain funds")}</strong>
            </div>
            <div className="vault-info-row">
              <span>Tracked tokens</span>
              <strong>{tokenBalances.length ? tokenBalances.map((entry) => entry.asset).join(" · ") : "None configured"}</strong>
            </div>
            <div className="vault-info-row">
              <span>Signed consent</span>
              <strong>{consentRecordedAt ? formatDateTime(consentRecordedAt) : "Pending"}</strong>
            </div>
            <div className="vault-info-row">
              <span>On-chain grant</span>
              <strong>{onchainGrantStatus}</strong>
            </div>
            <div className="vault-info-caption">
              {hasOnchainDeposit
                ? "NeuralRate detected funds at the vault address. Any token or amount sent directly to the vault can be reflected from on-chain balance telemetry."
                : consentDigest
                  ? `Consent digest ${truncate(consentDigest)}. Send funds directly to the vault whenever you are ready.`
                  : "Send funds directly to the vault address whenever you are ready; no preset funding amount is required."}
            </div>
          </div>

          <div className="vault-info-card vault-info-card-span-2 vault-execution-card">
            <div className="vault-swiss-kicker">Execution Trail</div>
            {latestJobs.length ? (
              <div className="vault-execution-list">
                {latestJobs.map((job) => {
                  const payload = parsePayloadJson(job.payload_json);
                  const targetAsset =
                    typeof payload?.targetAsset === "string" ? payload.targetAsset : DEMO_TARGET_ASSET;
                  const validationStatus =
                    typeof payload?.validationStatus === "string" ? payload.validationStatus : null;
                  const protocolId =
                    typeof payload?.protocolId === "string" ? payload.protocolId : null;
                  const resolvedContract =
                    typeof payload?.resolvedContract === "string" ? payload.resolvedContract : null;
                  const executionSummary =
                    typeof payload?.executionSummary === "string" ? payload.executionSummary : null;

                  return (
                    <div
                      key={job.job_id}
                      className="vault-execution-row"
                    >
                      <div className="vault-execution-row-main">
                        <div>
                          <div className="vault-execution-title">{humanize(job.job_type)}</div>
                          <div className="vault-execution-meta">
                            {targetAsset} · {humanize(job.execution_domain)} · {protocolId ? humanize(protocolId) : "Registry-pinned strategy"}
                          </div>
                        </div>
                        <strong className="vault-execution-status">{humanize(job.status)}</strong>
                      </div>
                      {validationStatus && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                          Validation {humanize(validationStatus)}
                        </div>
                      )}
                      {executionSummary && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                          {executionSummary}
                        </div>
                      )}
                      {resolvedContract && (
                        <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                          Contract {truncate(resolvedContract)}
                        </div>
                      )}
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                        {job.confirmed_at
                          ? `Confirmed ${formatDateTime(job.confirmed_at)}`
                          : job.created_at
                            ? `Created ${formatDateTime(job.created_at)}`
                            : "Awaiting execution update"}
                      </div>
                      {job.tx_hash && (
                        <a
                          href={`${MANTLE_EXPLORER_BASE_URL}/tx/${job.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--color-lime)", textDecoration: "none", fontSize: "0.74rem" }}
                        >
                          View tx {truncate(job.tx_hash)}
                        </a>
                      )}
                      {job.failure_reason && (
                        <div style={{ fontSize: "0.72rem", color: "var(--color-warning)", lineHeight: 1.45 }}>
                          {job.failure_reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="vault-info-caption">
                No execution jobs recorded yet. The trail will populate when the agent executes actions that match the active policy.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default VaultTelemetryPanel;
