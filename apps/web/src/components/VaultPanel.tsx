import React, { useState } from "react";
import {
  DEMO_TARGET_ASSET,
  MANAGED_SIGNER_PROVIDER,
  MANTLE_EXPLORER_BASE_URL,
  ONBOARDING_PROVIDER,
  VAULT_PROVIDER_STRATEGY,
} from "../config";
import type { McpAccessBundle } from "../lib/mcpAccess";
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
  mcpAccessBundle: McpAccessBundle | null;
  onIssueMcpAccess: () => Promise<McpAccessBundle>;
  onReviewOwnership: () => void;
  controlWalletLabel: string;
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
  mcpAccessBundle,
  onIssueMcpAccess,
  onReviewOwnership,
  controlWalletLabel,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const vault = state?.vault;
  const session = state?.activeSession;
  const activeGrant = state?.activeGrant;
  const activeMcpSession = state?.activeMcpSession;
  const ownershipAcknowledged = Boolean(vault?.ownership_acknowledged_at);
  const isActionGated = Boolean(vault) && !ownershipAcknowledged;
  const hasFundingIntent = parseNumeric(
    typeof vault?.last_funding_intent?.amountUsd === "number" || typeof vault?.last_funding_intent?.amountUsd === "string"
      ? vault.last_funding_intent.amountUsd
      : 0,
  ) > 0;
  const automationStatus = humanize(
    activeGrant?.status ??
    activeMcpSession?.status ??
    session?.session_status ??
    vault?.automation_status ??
    "inactive",
  );
  const fundingStatus = humanize(vault?.funding_status ?? "not-created");
  const consentRecordedAt = activeGrant?.issued_at ?? session?.consent_verified_at ?? null;
  const onchainPolicy = state?.onchainPolicy ?? null;
  const aa = state?.aa ?? null;
  const hasAutomation = Boolean(activeGrant && activeGrant.status === "active");
  const hasDemoQueued = (state?.automationJobs ?? []).length > 0;
  const mcpExecutionCatalog = mcpAccessBundle?.catalogs.execution ?? null;
  const mcpConfigCatalog = mcpAccessBundle?.catalogs.config ?? null;
  const mcpBundlePayload = mcpAccessBundle
    ? JSON.stringify(
        {
          type: mcpAccessBundle.recommendedTransport.type,
          url: mcpAccessBundle.recommendedTransport.url,
          queryUrl: mcpAccessBundle.recommendedTransport.queryUrl,
          headers: mcpAccessBundle.recommendedTransport.headers,
          ownerEoa: mcpAccessBundle.ownerEoa,
          vaultAddress: mcpAccessBundle.vaultAddress,
          allowedDomains: mcpAccessBundle.allowedDomains,
          expiresAt: mcpAccessBundle.expiresAt,
        },
        null,
        2,
      )
    : null;
  const onboardingSteps = [
    {
      key: "connect",
      label: "Connect wallet",
      done: isConnected && isCorrectChain,
      blockedBy: !isConnected ? "Connect your wallet to continue." : !isCorrectChain ? "Switch to Mantle Sepolia to proceed." : null,
    },
    {
      key: "vault",
      label: "Create vault",
      done: Boolean(vault),
      blockedBy: !vault ? "Bootstrap your dedicated user vault." : null,
    },
    {
      key: "fund",
      label: "Set funding intent",
      done: hasFundingIntent,
      blockedBy: vault && !hasFundingIntent ? "Register an initial funding intent (e.g. $1,000)." : null,
    },
    {
      key: "ownership",
      label: "Confirm ownership",
      done: ownershipAcknowledged,
      blockedBy: vault && !ownershipAcknowledged ? "Review wallet ownership before grants and execution." : null,
    },
    {
      key: "automation",
      label: "Enable automation",
      done: hasAutomation,
      blockedBy: ownershipAcknowledged && !hasAutomation ? "Issue a scoped automation grant from your control wallet." : null,
    },
    {
      key: "strategy",
      label: "Run first strategy",
      done: hasDemoQueued,
      blockedBy: hasAutomation && !hasDemoQueued ? `Queue ${DEMO_TARGET_ASSET} demo to validate end-to-end execution.` : null,
    },
  ];
  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const nextStep = onboardingSteps.find((step) => !step.done);

  const handleCopy = async (value: string | null | undefined, field: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, 1500);
    } catch {
      // best-effort UX only
    }
  };

  const renderCopyValue = (
    field: string,
    rawValue: string | null | undefined,
    displayValue: React.ReactNode,
    options?: {
      href?: string | null;
      accent?: boolean;
    },
  ) => {
    const copyEnabled = Boolean(rawValue);
    const copied = copiedField === field;
    const color = copied
      ? "var(--color-lime)"
      : options?.accent
        ? "var(--color-lime)"
        : "var(--text-primary)";

    return (
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: "0.4rem", minWidth: 0 }}>
        <button
          type="button"
          onClick={() => void handleCopy(rawValue, field)}
          disabled={!copyEnabled}
          title={!copyEnabled ? "No value available" : copied ? "Copied" : "Click to copy"}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            color,
            font: "inherit",
            fontWeight: 700,
            cursor: copyEnabled ? "copy" : "default",
            textAlign: "right",
            minWidth: 0,
            textDecoration: copyEnabled ? "underline dotted transparent" : "none",
            textUnderlineOffset: "0.18em",
            transition: "color 0.2s ease, text-decoration-color 0.2s ease",
          }}
          onMouseEnter={(event) => {
            if (copyEnabled) {
              event.currentTarget.style.textDecorationColor = "rgba(223, 246, 81, 0.45)";
            }
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.textDecorationColor = "transparent";
          }}
        >
          {copied ? "Copied" : displayValue}
        </button>
        {options?.href && (
          <a
            href={options.href}
            target="_blank"
            rel="noreferrer"
            title="Open in explorer"
            style={{ color: "var(--color-lime)", textDecoration: "none", fontSize: "0.82rem", lineHeight: 1, flexShrink: 0 }}
          >
            ↗
          </a>
        )}
      </span>
    );
  };

  return (
    <section className="glass-panel animate-enter vault-panel">
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
              {renderCopyValue("onboarding", ONBOARDING_PROVIDER, ONBOARDING_PROVIDER)}
            </div>
            <div style={rowStyle}>
              <span>Vault Strategy</span>
              {renderCopyValue("vault_strategy", VAULT_PROVIDER_STRATEGY, VAULT_PROVIDER_STRATEGY)}
            </div>
            <div style={rowStyle}>
              <span>Managed Signer</span>
              {renderCopyValue("managed_signer", MANAGED_SIGNER_PROVIDER, MANAGED_SIGNER_PROVIDER)}
            </div>
            <div style={rowStyle}>
              <span>Vault ID</span>
              {renderCopyValue("vault_id", vault?.vault_id, truncate(vault?.vault_id))}
            </div>
            <div style={rowStyle}>
              <span>Vault Address</span>
              {renderCopyValue(
                "vault_address",
                vault?.vault_address,
                vault?.vault_address ? truncate(vault.vault_address) : "Pending bootstrap",
                {
                  href: vault?.vault_address ? `${MANTLE_EXPLORER_BASE_URL}/address/${vault.vault_address}` : null,
                  accent: Boolean(vault?.vault_address),
                },
              )}
            </div>
            <div style={rowStyle}>
              <span>Funding Status</span>
              {renderCopyValue("funding_status", fundingStatus, fundingStatus)}
            </div>
            <div style={rowStyle}>
              <span>Automation</span>
              {renderCopyValue("automation_status", automationStatus, automationStatus)}
            </div>
            <div style={rowStyle}>
              <span>Signed Consent</span>
              {renderCopyValue("signed_consent", consentRecordedAt ? "Recorded" : "Pending", consentRecordedAt ? "Recorded" : "Pending", {
                accent: Boolean(consentRecordedAt),
              })}
            </div>
            <div style={rowStyle}>
              <span>Automation Ready</span>
              {renderCopyValue("automation_ready", state?.automationReady ? "Ready" : "Pending", state?.automationReady ? "Ready" : "Pending", {
                accent: Boolean(state?.automationReady),
              })}
            </div>
            <div style={rowStyle}>
              <span>Onchain Policy</span>
              {renderCopyValue(
                "onchain_policy",
                onchainPolicy?.policyId,
                onchainPolicy ? truncate(onchainPolicy.policyId) : "Not published",
                { accent: Boolean(onchainPolicy) },
              )}
            </div>
            <div style={rowStyle}>
              <span>AA Runtime</span>
              {renderCopyValue(
                "aa_runtime",
                aa?.safe4337ModuleAddress ? "Safe4337 + 7579" : "Safe module path",
                aa?.safe4337ModuleAddress ? "Safe4337 + 7579" : "Safe module path",
                { accent: Boolean(aa?.safe4337ModuleAddress) },
              )}
            </div>
          </div>

          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Your {controlWalletLabel.toLowerCase()} approves and revokes. The agent only operates inside this vault and within the policy bound to it.
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Signature trail: mutation auth signs API writes, grant signature opens scoped MCP domains, policy publish writes on-chain limits, and Safe/module transactions activate or revoke execution runtime.
          </div>
          {state?.automationReady && (
            <div
              style={{
                border: "1px solid rgba(223, 246, 81, 0.18)",
                borderRadius: "12px",
                background: "rgba(223, 246, 81, 0.04)",
                padding: "0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.7rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 700 }}>MCP Access</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.18rem", lineHeight: 1.45 }}>
                    Generate a scoped credential bundle for your external agent. Each new bundle rotates the current MCP token.
                  </div>
                </div>
                <ActionButton
                  label={mcpAccessBundle ? "Refresh MCP Access" : "Generate MCP Access"}
                  onClick={onIssueMcpAccess}
                  disabled={busy || !hasAutomation}
                />
              </div>
              {mcpAccessBundle ? (
                <>
                  <div className="vault-detail-grid">
                    <div style={rowStyle}>
                      <span>Execution MCP</span>
                      {renderCopyValue(
                        "mcp_execution_http",
                        mcpExecutionCatalog?.httpUrl,
                        mcpExecutionCatalog?.httpUrl ? truncate(mcpExecutionCatalog.httpUrl) : "Unavailable",
                        { accent: Boolean(mcpExecutionCatalog?.allowed) },
                      )}
                    </div>
                    <div style={rowStyle}>
                      <span>Execution Query</span>
                      {renderCopyValue(
                        "mcp_execution_query",
                        mcpExecutionCatalog?.queryHttpUrl,
                        mcpExecutionCatalog?.queryHttpUrl ? truncate(mcpExecutionCatalog.queryHttpUrl) : "Unavailable",
                        { accent: Boolean(mcpExecutionCatalog?.allowed) },
                      )}
                    </div>
                    <div style={rowStyle}>
                      <span>Config MCP</span>
                      {renderCopyValue(
                        "mcp_config_http",
                        mcpConfigCatalog?.httpUrl,
                        mcpConfigCatalog?.httpUrl ? truncate(mcpConfigCatalog.httpUrl) : "Unavailable",
                        { accent: Boolean(mcpConfigCatalog?.allowed) },
                      )}
                    </div>
                    <div style={rowStyle}>
                      <span>Token Expires</span>
                      {renderCopyValue(
                        "mcp_expires_at",
                        mcpAccessBundle.expiresAt,
                        new Date(mcpAccessBundle.expiresAt).toLocaleString(),
                        { accent: true },
                      )}
                    </div>
                    <div style={rowStyle}>
                      <span>Session Token</span>
                      {renderCopyValue("mcp_session_token", mcpAccessBundle.sessionToken, truncate(mcpAccessBundle.sessionToken), {
                        accent: true,
                      })}
                    </div>
                    <div style={rowStyle}>
                      <span>Header</span>
                      {renderCopyValue(
                        "mcp_header",
                        `${mcpAccessBundle.headerName}: ${mcpAccessBundle.sessionToken}`,
                        mcpAccessBundle.headerName,
                        { accent: true },
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                    <ActionButton
                      label={copiedField === "mcp_agent_payload" ? "Copied Agent Payload" : "Copy Agent Payload"}
                      onClick={() => handleCopy(mcpBundlePayload, "mcp_agent_payload")}
                      disabled={!mcpBundlePayload}
                    />
                    <ActionButton
                      label={copiedField === "mcp_execution_query_direct" ? "Copied Query URL" : "Copy Execution Query URL"}
                      onClick={() => handleCopy(mcpExecutionCatalog?.queryHttpUrl, "mcp_execution_query_direct")}
                      disabled={!mcpExecutionCatalog?.queryHttpUrl}
                    />
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    To let the agent operate, send the `Execution MCP` endpoint plus the `x-neuralrate-session-token` header, or use the query URL if your client cannot set headers.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  After automation is active, generate a bundle here and pass it to the agent as a scoped MCP connection. The execution route grants read tools plus `execute_strategy`; use the config route only if the agent also needs to change policy.
                </div>
              )}
            </div>
          )}
          <div
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.02)",
              padding: "0.9rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 700 }}>Guided Onboarding</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                {completedSteps}/{onboardingSteps.length} complete
              </div>
            </div>
            {nextStep?.blockedBy && (
              <div style={{ fontSize: "0.74rem", color: "var(--color-warning)", lineHeight: 1.45 }}>
                Next unblock: {nextStep.blockedBy}
              </div>
            )}
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {onboardingSteps.map((step, index) => (
                <div
                  key={step.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "24px 1fr",
                    gap: "0.55rem",
                    alignItems: "start",
                    opacity: step.done ? 1 : 0.9,
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "999px",
                      display: "grid",
                      placeItems: "center",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      background: step.done ? "rgba(223, 246, 81, 0.16)" : "rgba(255,255,255,0.06)",
                      color: step.done ? "var(--color-lime)" : "var(--text-secondary)",
                      border: step.done ? "1px solid rgba(223, 246, 81, 0.35)" : "1px solid var(--border-subtle)",
                    }}
                  >
                    {step.done ? "✓" : index + 1}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-primary)", fontWeight: 600 }}>{step.label}</div>
                    {!step.done && step.blockedBy && (
                      <div style={{ fontSize: "0.71rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{step.blockedBy}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
    </section>
  );
};

export default VaultPanel;
