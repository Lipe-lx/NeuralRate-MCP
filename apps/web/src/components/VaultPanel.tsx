import React, { useState } from "react";
import {
  DELEGATE_VALIDATOR_ADDRESS,
  MANAGED_SIGNER_PROVIDER,
  MANTLE_EXPLORER_BASE_URL,
  MOCK_USDY_TOKEN_ADDRESS,
  NEURALRATE_EXECUTION_GUARD_CONTRACT,
  ONBOARDING_PROVIDER,
  SAFE_7579_ADAPTER_ADDRESS,
  VAULT_PROVIDER_STRATEGY,
} from "../config";
import { loadStoredMcpAccessBundle, type McpAccessBundle } from "../lib/mcpAccess";
import { hasDetectedVaultDeposit, type AutomationState } from "../lib/userState";

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
  onEnableAutomation: () => Promise<void>;
  onCompleteRuntimeSetup: () => Promise<void>;
  onRevokeAutomation: () => Promise<void>;
  mcpAccessBundle: McpAccessBundle | null;
  onIssueMcpAccess: () => Promise<McpAccessBundle>;
  onReviewOwnership: () => void;
  controlWalletLabel: string;
  onRefreshState: () => Promise<unknown>;
  onMintMockUsdy: (amountToken: string) => Promise<{ txHash: string; tokenAddress: string; amountToken: string }>;
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
  onEnableAutomation,
  onCompleteRuntimeSetup,
  onRevokeAutomation,
  mcpAccessBundle,
  onIssueMcpAccess,
  onReviewOwnership,
  controlWalletLabel,
  onRefreshState,
  onMintMockUsdy,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showMcpAdvanced, setShowMcpAdvanced] = useState(false);
  const [showVaultAdvanced, setShowVaultAdvanced] = useState(false);
  const [mockUsdyAmount, setMockUsdyAmount] = useState("100");
  const [mockUsdyMinting, setMockUsdyMinting] = useState(false);
  const [mockUsdyTxHash, setMockUsdyTxHash] = useState<string | null>(null);
  const [mockUsdyError, setMockUsdyError] = useState<string | null>(null);
  const vault = state?.vault;
  const storedBundle = React.useMemo(() => state?.ownerEoa ? loadStoredMcpAccessBundle(state.ownerEoa) : null, [state?.ownerEoa]);
  const hasSession = Boolean(storedBundle?.sessionToken);
  const session = state?.activeSession;
  const activeGrant = state?.activeGrant;
  const activeMcpSession = state?.activeMcpSession;
  const ownershipAcknowledged = Boolean(vault?.ownership_acknowledged_at);
  const hasOnchainDeposit = hasDetectedVaultDeposit(state);
  const depositAddress = vault?.deposit_address ?? vault?.vault_address ?? null;
  const automationStatus = humanize(
    activeGrant?.status ??
    activeMcpSession?.status ??
    session?.session_status ??
    vault?.automation_status ??
    "inactive",
  );
  const fundingStatus = hasOnchainDeposit ? "Deposit detected" : humanize(vault?.funding_status ?? "not-created");
  const mockUsdyConfigured = Boolean(MOCK_USDY_TOKEN_ADDRESS);
  const consentRecordedAt = activeGrant?.issued_at ?? session?.consent_verified_at ?? null;
  const onchainPolicy = state?.onchainPolicy ?? null;
  const hasAutomation = Boolean(activeGrant && activeGrant.status === "active");
  const runtimePending = hasAutomation && !state?.automationReady;
  const runtimeChecklist = [
    {
      key: "vault_module",
      label: "Enable vault module",
      done: Boolean(state?.runtimeState?.vaultModuleEnabled),
    },
    SAFE_7579_ADAPTER_ADDRESS ? {
      key: "safe7579",
      label: "Install Safe7579",
      done: Boolean(state?.runtimeState?.safe7579Enabled),
    } : null,
    DELEGATE_VALIDATOR_ADDRESS ? {
      key: "delegate",
      label: "Install delegate validator",
      done: Boolean(state?.runtimeState?.delegateReady),
    } : null,
    SAFE_7579_ADAPTER_ADDRESS ? {
      key: "fallback",
      label: "Enable fallback handler",
      done: Boolean(state?.runtimeState?.fallbackHandlerReady ?? state?.runtimeState?.fallbackReady),
    } : null,
    NEURALRATE_EXECUTION_GUARD_CONTRACT ? {
      key: "guard",
      label: "Enable execution guard",
      done: Boolean(state?.runtimeState?.moduleGuardReady),
    } : null,
  ].filter((item): item is { key: string; label: string; done: boolean } => Boolean(item));
  const completedRuntimeSteps = runtimeChecklist.filter((item) => item.done).length;
  const runtimeStepCount = runtimeChecklist.length;
  const aaRuntimeStatus = state?.automationReady
    ? "Ready"
    : hasAutomation
      ? completedRuntimeSteps > 0
        ? `Partial ${completedRuntimeSteps}/${runtimeStepCount}`
        : "Pending"
      : "Not enabled";
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
      key: "grant",
      label: "Issue grant",
      done: hasAutomation,
      blockedBy: vault && !hasAutomation ? "Issue a scoped automation grant from your control wallet." : null,
    },
    {
      key: "runtime",
      label: "Activate runtime",
      done: Boolean(state?.automationReady),
      blockedBy: hasAutomation && !state?.automationReady ? "Finish the Safe runtime checklist so the agent can actually execute." : null,
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

  const handleMintMockUsdy = async () => {
    setMockUsdyMinting(true);
    setMockUsdyError(null);
    setMockUsdyTxHash(null);
    try {
      const result = await onMintMockUsdy(mockUsdyAmount);
      setMockUsdyTxHash(result.txHash);
    } catch (mintError) {
      setMockUsdyError(mintError instanceof Error ? mintError.message : "Mock USDY mint failed.");
    } finally {
      setMockUsdyMinting(false);
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {state?.ownerEoa && (
                <button
                  onClick={() => void onRefreshState()}
                  disabled={busy}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--color-lime)",
                    cursor: busy ? "not-allowed" : "pointer",
                    fontSize: "0.74rem",
                    padding: "0.2rem 0.4rem",
                    borderRadius: "4px",
                    textDecoration: "underline",
                  }}
                >
                  {busy ? "Refreshing..." : hasSession ? "Refresh" : "Refresh (Sign)"}
                </button>
              )}
              <div style={{ fontSize: "0.72rem", color: "var(--color-lime)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Sepolia</div>
            </div>
          </div>

          <div className="vault-detail-grid">
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
              <span>Automation Ready</span>
              {renderCopyValue("automation_ready", state?.automationReady ? "Ready" : "Pending", state?.automationReady ? "Ready" : "Pending", {
                accent: Boolean(state?.automationReady),
              })}
            </div>
            <div style={rowStyle}>
              <span>AA Runtime</span>
              {renderCopyValue(
                "aa_runtime",
                aaRuntimeStatus,
                aaRuntimeStatus,
                { accent: Boolean(state?.automationReady) },
              )}
            </div>

            <div style={{ gridColumn: "span 2", marginTop: "0.2rem" }}>
              <button
                type="button"
                onClick={() => setShowVaultAdvanced(!showVaultAdvanced)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-lime)",
                  cursor: "pointer",
                  fontSize: "0.74rem",
                  padding: "0.2rem 0",
                  textDecoration: "underline",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                {showVaultAdvanced ? "Hide technical details ▲" : "Show technical details ▼"}
              </button>
            </div>

            {showVaultAdvanced && (
              <>
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
                  <span>Signed Consent</span>
                  {renderCopyValue("signed_consent", consentRecordedAt ? "Recorded" : "Pending", consentRecordedAt ? "Recorded" : "Pending", {
                    accent: Boolean(consentRecordedAt),
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
              </>
            )}
          </div>

          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Your {controlWalletLabel.toLowerCase()} approves and revokes. The agent only operates inside this vault and within the policy bound to it.
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Signature trail: mutation auth signs API writes, grant signature opens scoped MCP domains, policy publish writes on-chain limits, and Safe/module transactions activate or revoke execution runtime.
          </div>
          {depositAddress && (
            <div
              style={{
                border: "1px solid rgba(223, 246, 81, 0.16)",
                background: "rgba(223, 246, 81, 0.045)",
                borderRadius: "12px",
                padding: "0.85rem 0.95rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.85rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 700 }}>
                  Deposit to Vault
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.45, marginTop: "0.18rem" }}>
                  Send any supported token or amount directly to this vault. NeuralRate detects on-chain balances automatically; no funding intent is required.
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-primary)", marginTop: "0.42rem" }}>
                  {renderCopyValue("deposit_address_inline", depositAddress, truncate(depositAddress), {
                    href: `${MANTLE_EXPLORER_BASE_URL}/address/${depositAddress}`,
                    accent: true,
                  })}
                </div>
              </div>
              <ActionButton
                label={copiedField === "deposit_address" ? "Copied" : "Copy Address"}
                tone="primary"
                onClick={() => handleCopy(depositAddress, "deposit_address")}
                disabled={!depositAddress}
              />
            </div>
          )}
          {depositAddress && mockUsdyConfigured && (
            <div
              style={{
                border: "1px solid rgba(111, 205, 255, 0.18)",
                background: "rgba(111, 205, 255, 0.055)",
                borderRadius: "12px",
                padding: "0.85rem 0.95rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.85rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 270px" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 700 }}>
                  Mock USDY Faucet
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.45, marginTop: "0.18rem" }}>
                  Mints testnet Mock USDY directly to this vault for Sepolia demo execution.
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-primary)", marginTop: "0.42rem" }}>
                  {renderCopyValue("mock_usdy_token", MOCK_USDY_TOKEN_ADDRESS, truncate(MOCK_USDY_TOKEN_ADDRESS), {
                    href: `${MANTLE_EXPLORER_BASE_URL}/address/${MOCK_USDY_TOKEN_ADDRESS}`,
                    accent: true,
                  })}
                </div>
                {mockUsdyTxHash && (
                  <div style={{ fontSize: "0.72rem", marginTop: "0.42rem" }}>
                    {renderCopyValue("mock_usdy_mint_tx", mockUsdyTxHash, `Tx ${truncate(mockUsdyTxHash)}`, {
                      href: `${MANTLE_EXPLORER_BASE_URL}/tx/${mockUsdyTxHash}`,
                      accent: true,
                    })}
                  </div>
                )}
                {mockUsdyError && (
                  <div style={{ fontSize: "0.72rem", color: "var(--color-danger)", marginTop: "0.42rem" }}>
                    {mockUsdyError}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
                <input
                  value={mockUsdyAmount}
                  onChange={(event) => setMockUsdyAmount(event.target.value)}
                  inputMode="decimal"
                  aria-label="Mock USDY amount"
                  style={{
                    width: "7.5rem",
                    minHeight: "2.15rem",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text-primary)",
                    padding: "0.45rem 0.55rem",
                    fontSize: "0.8rem",
                  }}
                />
                <ActionButton
                  label={mockUsdyMinting ? "Minting..." : "Mint Mock USDY"}
                  tone="primary"
                  onClick={handleMintMockUsdy}
                  disabled={!isConnected || !isCorrectChain || busy || mockUsdyMinting}
                />
              </div>
            </div>
          )}
          {runtimePending && (
            <div
              style={{
                border: "1px solid rgba(255, 184, 77, 0.22)",
                background: "rgba(255, 184, 77, 0.08)",
                borderRadius: "12px",
                padding: "0.9rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.7rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 700 }}>Runtime Setup Pending</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.18rem", lineHeight: 1.45 }}>
                    The grant is active, but the vault still cannot execute. Finish these on-chain Safe actions to make the agent operational.
                  </div>
                </div>
                <ActionButton
                  label={busy ? "Finishing..." : "Finish Runtime Setup"}
                  tone="primary"
                  onClick={onCompleteRuntimeSetup}
                  disabled={busy}
                />
              </div>
              <div style={{ display: "grid", gap: "0.45rem" }}>
                {runtimeChecklist.map((step) => (
                  <div
                    key={step.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      fontSize: "0.76rem",
                      color: step.done ? "var(--color-lime)" : "var(--text-secondary)",
                    }}
                  >
                    <span>{step.label}</span>
                    <span style={{ fontWeight: 700 }}>{step.done ? "Done" : "Pending"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                    Created automatically when automation is enabled. Rotate only if you need to reconnect an external agent or recover access on this browser.
                  </div>
                </div>
                <ActionButton
                  label={mcpAccessBundle ? "Rotate MCP Token" : "Recover MCP Access"}
                  onClick={onIssueMcpAccess}
                  disabled={busy || !hasAutomation}
                />
              </div>

              {mcpAccessBundle ? (
                <>
                  <div className="vault-detail-grid">
                    <div style={rowStyle}>
                      <span>Endpoint URL</span>
                      {renderCopyValue("mcp_endpoint", mcpAccessBundle.recommendedTransport.url, truncate(mcpAccessBundle.recommendedTransport.url))}
                    </div>
                    <div style={rowStyle}>
                      <span>Session Token</span>
                      {renderCopyValue("mcp_token", mcpAccessBundle.sessionToken, truncate(mcpAccessBundle.sessionToken))}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.2rem" }}>
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

                  <div style={{ marginTop: "0.3rem" }}>
                    <button
                      type="button"
                      onClick={() => setShowMcpAdvanced(!showMcpAdvanced)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--color-lime)",
                        cursor: "pointer",
                        fontSize: "0.74rem",
                        padding: "0.2rem 0",
                        textDecoration: "underline",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      {showMcpAdvanced ? "Hide advanced connection details ▲" : "Show advanced connection details ▼"}
                    </button>
                  </div>

                  {showMcpAdvanced && (
                    <div className="vault-detail-grid" style={{ marginTop: "0.4rem", paddingTop: "0.4rem", borderTop: "1px dashed var(--border-subtle)", animation: "fadeIn 0.2s ease-out" }}>
                      <div style={rowStyle}>
                        <span>MCP Type</span>
                        {renderCopyValue("mcp_type", mcpAccessBundle.recommendedTransport.type, mcpAccessBundle.recommendedTransport.type)}
                      </div>
                      <div style={rowStyle}>
                        <span>Token Header</span>
                        {renderCopyValue("mcp_header_name", "x-neuralrate-session-token", "x-neuralrate-session-token")}
                      </div>
                      <div style={rowStyle}>
                        <span>Allowed Domains</span>
                        {renderCopyValue(
                          "mcp_domains",
                          mcpAccessBundle.allowedDomains.join(", "),
                          mcpAccessBundle.allowedDomains.length ? mcpAccessBundle.allowedDomains.join(", ") : "Any",
                        )}
                      </div>
                      <div style={rowStyle}>
                        <span>Expires At</span>
                        {renderCopyValue("mcp_expires", mcpAccessBundle.expiresAt, new Date(mcpAccessBundle.expiresAt).toLocaleDateString())}
                      </div>
                      {mcpConfigCatalog?.httpUrl && (
                        <div style={rowStyle}>
                          <span>Config Endpoint</span>
                          {renderCopyValue("mcp_config_endpoint", mcpConfigCatalog.httpUrl, truncate(mcpConfigCatalog.httpUrl))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Automation normally creates this bundle for you. If this browser lost the session, recover it here and pass the execution route to the agent as the scoped MCP connection. Use the config route only when the agent also needs to change policy.
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
               {nextStep ? (
                 <div
                   key={nextStep.key}
                   style={{
                     display: "grid",
                     gridTemplateColumns: "24px 1fr",
                     gap: "0.55rem",
                     alignItems: "start",
                     opacity: 1,
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
                       background: "rgba(255, 255, 255, 0.06)",
                       color: "var(--text-secondary)",
                       border: "1px solid var(--border-subtle)",
                     }}
                   >
                     {onboardingSteps.indexOf(nextStep) + 1}
                   </div>
                   <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                     <div style={{ fontSize: "0.76rem", color: "var(--text-primary)", fontWeight: 600 }}>{nextStep.label}</div>
                     {nextStep.blockedBy && (
                       <div style={{ fontSize: "0.71rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{nextStep.blockedBy}</div>
                     )}
                   </div>
                 </div>
               ) : (
                 <div style={{ fontSize: "0.78rem", color: "var(--color-lime)", fontWeight: 600 }}>
                   ✓ All onboarding steps completed! Vault automation is active.
                 </div>
               )}
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
                Optional wallet ownership review
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                This Safe vault can already receive funds and be authorized. Reopen the handoff anytime to review the control wallet and export flow.
              </div>
              <div>
                <ActionButton label="Review Wallet Ownership" onClick={onReviewOwnership} />
              </div>
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
                {!activeGrant || activeGrant.status === "revoked" ? (
                  <ActionButton
                    label={busy ? "Enabling..." : "Enable Automation"}
                    tone="primary"
                    onClick={onEnableAutomation}
                    disabled={busy || !vault.vault_address}
                  />
                ) : runtimePending ? (
                  <>
                    <ActionButton
                      label={busy ? "Finishing..." : "Finish Runtime Setup"}
                      tone="primary"
                      onClick={onCompleteRuntimeSetup}
                      disabled={busy}
                    />
                    <ActionButton
                      label={busy ? "Revoking..." : "Revoke Automation"}
                      tone="warning"
                      onClick={onRevokeAutomation}
                      disabled={busy}
                    />
                  </>
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

          {vault && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
              <ActionButton
                label="Review Wallet Ownership"
                onClick={onReviewOwnership}
                disabled={busy}
              />
            </div>
          )}

          {!activeGrant && vault && (
            <div style={{ fontSize: "0.76rem", color: "var(--color-warning)", lineHeight: 1.5 }}>
              Automation remains manual-only until this wallet issues a vault-scoped MCP grant.
            </div>
          )}
          {runtimePending && (
            <div style={{ fontSize: "0.76rem", color: "var(--color-warning)", lineHeight: 1.5 }}>
              The grant is live, but the vault runtime is still pending. The agent should not be told to operate until the runtime checklist turns green.
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
