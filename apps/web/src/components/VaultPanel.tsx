import React from "react";
import {
  DEMO_TARGET_ASSET,
  MANAGED_SIGNER_PROVIDER,
  MANTLE_EXPLORER_BASE_URL,
  ONBOARDING_PROVIDER,
  VAULT_PROVIDER_STRATEGY,
} from "../config";
import type { AutomationState } from "../lib/userState";

type Props = {
  state: AutomationState | null;
  busy: boolean;
  notice: string | null;
  error: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  onConnect: () => Promise<void>;
  onSwitchChain: () => Promise<void>;
  onBootstrap: () => Promise<unknown>;
  onFundingIntent: (amountUsd: number) => Promise<void>;
  onEnableAutomation: () => Promise<void>;
  onRevokeAutomation: () => Promise<void>;
  onQueueDemoStrategy: () => Promise<void>;
  onReviewOwnership: () => void;
  controlWalletLabel: string;
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);

const formatCount = (value: number) => new Intl.NumberFormat("en-US").format(value);

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

const getRecordNumber = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "number" || typeof value === "string" ? parseNumeric(value) : 0;
};

const getRecordString = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
};

const humanize = (value: string | null | undefined) =>
  value
    ? value
        .split(/[:_-]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Not available";

const ActionButton: React.FC<{
  label: string;
  onClick: () => void | Promise<unknown>;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "warning";
}> = ({ label, onClick, disabled, tone = "secondary" }) => {
  const background =
    tone === "primary"
      ? "var(--color-lime)"
      : tone === "warning"
        ? "rgba(255, 184, 77, 0.12)"
        : "transparent";
  const color =
    tone === "primary"
      ? "#06110a"
      : tone === "warning"
        ? "var(--color-warning)"
        : "var(--text-secondary)";

  return (
    <button
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      style={{
        border: tone === "primary" ? "none" : "1px solid var(--border-subtle)",
        background,
        color,
        padding: "0.5rem 0.7rem",
        borderRadius: "8px",
        fontWeight: 700,
        fontSize: "0.78rem",
        lineHeight: 1.2,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {label}
    </button>
  );
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "0.75rem",
  fontSize: "0.8rem",
  color: "var(--text-secondary)",
};

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

const VaultPanel: React.FC<Props> = ({
  state,
  busy,
  notice,
  error,
  isConnected,
  isCorrectChain,
  onConnect,
  onSwitchChain,
  onBootstrap,
  onFundingIntent,
  onEnableAutomation,
  onRevokeAutomation,
  onQueueDemoStrategy,
  onReviewOwnership,
  controlWalletLabel,
}) => {
  const vault = state?.vault;
  const config = state?.config;
  const session = state?.activeSession;
  const activeGrant = state?.activeGrant;
  const activeMcpSession = state?.activeMcpSession;
  const activePermission = state?.activePermission;
  const ownershipAcknowledged = Boolean(vault?.ownership_acknowledged_at);
  const isActionGated = Boolean(vault) && !ownershipAcknowledged;
  const managedValueUsd = parseNumeric(vault?.balance_usd);
  const fundingIntentUsd = getRecordNumber(vault?.last_funding_intent, "amountUsd");
  const fundingIntentSource = humanize(getRecordString(vault?.last_funding_intent, "source"));
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
    "inactive"
  );
  const fundingStatus = humanize(vault?.funding_status ?? "not-created");
  const policyPreset = humanize(config?.restriction_preset ?? "not-set");
  const riskProfile = humanize(config?.risk_profile ?? "medium");
  const consentRecordedAt = activeGrant?.issued_at ?? session?.consent_verified_at ?? null;
  const consentDigest = activeGrant?.grant_id ?? session?.consent_digest ?? session?.permission_id ?? null;
  const onchainGrantStatus = activeGrant?.status === "active" ? "Granted" : session?.grant_tx_hash ? "Executed" : "Not issued";
  const automationJobs = state?.automationJobs ?? [];
  const latestJobs = automationJobs.slice(0, 3);

  return (
    <section className="glass-panel animate-enter vault-panel">
      <div className="vault-panel-layout">
        <div className="vault-panel-main">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Vault</h2>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Dedicated user vault, isolated from every other user
              </div>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--color-lime)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Sepolia</div>
          </div>

          <div className="vault-detail-grid">
            <div style={rowStyle}>
              <span>Onboarding</span>
              <strong style={{ color: "var(--text-primary)" }}>{ONBOARDING_PROVIDER}</strong>
            </div>
            <div style={rowStyle}>
              <span>Vault Strategy</span>
              <strong style={{ color: "var(--text-primary)" }}>{VAULT_PROVIDER_STRATEGY}</strong>
            </div>
            <div style={rowStyle}>
              <span>Managed Signer</span>
              <strong style={{ color: "var(--text-primary)" }}>{MANAGED_SIGNER_PROVIDER}</strong>
            </div>
            <div style={rowStyle}>
              <span>Vault ID</span>
              <strong style={{ color: "var(--text-primary)" }}>{truncate(vault?.vault_id)}</strong>
            </div>
            <div style={rowStyle}>
              <span>Vault Address</span>
              <strong style={{ color: "var(--text-primary)" }}>
                {vault?.vault_address ? (
                  <a
                    href={`${MANTLE_EXPLORER_BASE_URL}/address/${vault.vault_address}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--color-lime)", textDecoration: "none" }}
                  >
                    {truncate(vault.vault_address)}
                  </a>
                ) : (
                  "Pending bootstrap"
                )}
              </strong>
            </div>
            <div style={rowStyle}>
              <span>Funding Status</span>
              <strong style={{ color: "var(--text-primary)" }}>{fundingStatus}</strong>
            </div>
            <div style={rowStyle}>
              <span>Automation</span>
              <strong style={{ color: "var(--text-primary)" }}>{automationStatus}</strong>
            </div>
            <div style={rowStyle}>
              <span>Signed Consent</span>
              <strong style={{ color: consentRecordedAt ? "var(--color-lime)" : "var(--text-primary)" }}>
                {consentRecordedAt ? "Recorded" : "Pending"}
              </strong>
            </div>
            <div style={rowStyle}>
              <span>Automation Ready</span>
              <strong style={{ color: state?.automationReady ? "var(--color-lime)" : "var(--text-primary)" }}>
                {state?.automationReady ? "Ready" : "Pending"}
              </strong>
            </div>
          </div>

          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Your {controlWalletLabel.toLowerCase()} approves and revokes. The agent only operates inside this vault and within the policy bound to it.
          </div>

          {vault && !ownershipAcknowledged && (
            <div
              style={{
                border: "1px solid rgba(255, 184, 77, 0.22)",
                background: "rgba(255, 184, 77, 0.08)",
                borderRadius: "12px",
                padding: "0.85rem 0.95rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
              }}
            >
              <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 700 }}>
                Review vault ownership before funding or enabling automation
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This Safe vault can already receive funds, but funding and automation stay locked until you confirm you understand how the control wallet and export flow work.
              </div>
              <div>
                <ActionButton label="Review Wallet Ownership" onClick={onReviewOwnership} />
              </div>
            </div>
          )}

          {vault?.deposit_address && (
            <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
              Deposit address:{" "}
              <span className="vault-inline-address" title={vault.deposit_address} style={{ color: "var(--text-primary)" }}>
                {vault.deposit_address}
              </span>
            </div>
          )}

          <div className="vault-actions-grid">
            {!isConnected ? (
              <ActionButton label="Connect Wallet" tone="primary" onClick={onConnect} disabled={busy} />
            ) : !isCorrectChain ? (
              <ActionButton label="Switch to Mantle" tone="primary" onClick={onSwitchChain} disabled={busy} />
            ) : !vault ? (
              <ActionButton label={busy ? "Bootstrapping..." : "Create User Vault"} tone="primary" onClick={onBootstrap} disabled={busy} />
            ) : (
              <>
                <ActionButton label="Funding Intent" onClick={() => onFundingIntent(1000)} disabled={busy || isActionGated} />
                {!activeGrant || activeGrant.status === "revoked" ? (
                  <ActionButton
                    label={busy ? "Enabling..." : "Enable Automation"}
                    tone="primary"
                    onClick={onEnableAutomation}
                    disabled={busy || !vault.vault_address || isActionGated}
                  />
                ) : (
                  <ActionButton
                    label={busy ? "Revoking..." : "Revoke Automation"}
                    tone="warning"
                    onClick={onRevokeAutomation}
                    disabled={busy}
                  />
                )}
              </>
            )}
          </div>

          {vault && ownershipAcknowledged && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              <ActionButton
                label="Review Wallet Ownership"
                onClick={onReviewOwnership}
                disabled={busy}
              />
              <ActionButton
                label={busy ? "Queueing Demo..." : `Queue ${DEMO_TARGET_ASSET} Demo`}
                tone="primary"
                onClick={onQueueDemoStrategy}
                disabled={busy || !activeGrant || activeGrant.status !== "active"}
              />
            </div>
          )}

          {!activeGrant && vault && ownershipAcknowledged && (
            <div style={{ fontSize: "0.76rem", color: "var(--color-warning)", lineHeight: 1.5 }}>
              Automation remains manual-only until this wallet issues a vault-scoped MCP grant.
            </div>
          )}

          {(notice || error) && (
            <div className="vault-feedback-strip">
              {notice && <div style={{ color: "var(--color-lime)" }}>{notice}</div>}
              {error && <div style={{ color: "var(--color-danger)" }}>{error}</div>}
            </div>
          )}
        </div>

        <aside className="vault-panel-aside organic-col-divider">
          <div className="vault-swiss-kicker">Vault Telemetry</div>
          <div className="vault-hero-card">
            <div className="vault-metric-eyebrow">Managed Capital</div>
            <div className="vault-hero-value">{formatUsd(managedValueUsd)}</div>
            <div className="vault-hero-note">Current balance administered inside this dedicated Safe vault.</div>
            <div className="vault-status-strip">
              <span>{fundingStatus}</span>
              <span>{automationStatus}</span>
            </div>
            <div className="vault-budget-rail">
              <div className="vault-budget-rail-fill" style={{ width: `${budgetCoverage}%` }} />
            </div>
            <div className="vault-budget-caption">
              Policy ceiling {formatUsd(automationBudgetUsd)} {automationBudgetUsd > 0 ? `• ${Math.round(budgetCoverage)}% currently represented` : ""}
            </div>
          </div>

          <div className="vault-metric-grid">
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

          <div className="vault-info-grid">
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
                <span>Funding intent</span>
                <strong>{fundingIntentUsd > 0 ? formatUsd(fundingIntentUsd) : "None"}</strong>
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
                {consentDigest
                  ? `Consent digest ${truncate(consentDigest)}${fundingIntentUsd > 0 ? ` • last funding source: ${fundingIntentSource}` : ""}`
                  : fundingIntentUsd > 0
                    ? `Last funding source: ${fundingIntentSource}`
                    : "Create a funding intent to stage the first deposit into the vault."}
              </div>
            </div>

            <div className="vault-info-card">
              <div className="vault-swiss-kicker">Execution Trail</div>
              {latestJobs.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
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
                        style={{
                          border: "1px solid var(--border-subtle)",
                          borderRadius: "12px",
                          padding: "0.8rem",
                          background: "rgba(255,255,255,0.02)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem",
                        }}
                      >
                        <div className="vault-info-row">
                          <span>{humanize(job.job_type)}</span>
                          <strong>{humanize(job.status)}</strong>
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                          {targetAsset} · {humanize(job.execution_domain)} · {protocolId ? humanize(protocolId) : "Registry-pinned strategy"}
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
                  No execution jobs recorded yet. Queue the {DEMO_TARGET_ASSET} demo after enabling automation to populate the audit trail.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

export default VaultPanel;
