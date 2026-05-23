import React from "react";
import {
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
  onReviewOwnership: () => void;
  controlWalletLabel: string;
};

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
        padding: "0.55rem 0.75rem",
        borderRadius: "8px",
        fontWeight: 700,
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
  onReviewOwnership,
  controlWalletLabel,
}) => {
  const vault = state?.vault;
  const session = state?.activeSession;
  const ownershipAcknowledged = Boolean(vault?.ownership_acknowledged_at);
  const isActionGated = Boolean(vault) && !ownershipAcknowledged;

  return (
    <section className="glass-panel animate-enter" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Vault</h2>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Dedicated user vault, isolated from every other user
          </div>
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--color-lime)" }}>Sepolia</div>
      </div>

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
        <strong style={{ color: "var(--text-primary)" }}>{vault?.funding_status ?? "not-created"}</strong>
      </div>
      <div style={rowStyle}>
        <span>Automation</span>
        <strong style={{ color: "var(--text-primary)" }}>{session?.session_status ?? vault?.automation_status ?? "inactive"}</strong>
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
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
          <div style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontWeight: 700 }}>
            Review vault ownership before funding or enabling automation
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            This Safe vault can already receive funds, but funding and automation stay locked until you confirm you understand how the control wallet and export flow work.
          </div>
          <div>
            <ActionButton label="Review Wallet Ownership" onClick={onReviewOwnership} />
          </div>
        </div>
      )}

      {vault?.deposit_address && (
        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Deposit address:{" "}
          <span style={{ color: "var(--text-primary)", wordBreak: "break-all" }}>{vault.deposit_address}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.6rem" }}>
        {!isConnected ? (
          <ActionButton label="Connect Wallet" tone="primary" onClick={onConnect} disabled={busy} />
        ) : !isCorrectChain ? (
          <ActionButton label="Switch to Mantle" tone="primary" onClick={onSwitchChain} disabled={busy} />
        ) : !vault ? (
          <ActionButton label={busy ? "Bootstrapping..." : "Create User Vault"} tone="primary" onClick={onBootstrap} disabled={busy} />
        ) : (
          <>
            <ActionButton label="Funding Intent" onClick={() => onFundingIntent(1000)} disabled={busy || isActionGated} />
            {!session || session.session_status === "revoked" ? (
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

      {vault && (
        <ActionButton
          label="Review Wallet Ownership"
          onClick={onReviewOwnership}
          disabled={busy}
        />
      )}

      {notice && <div style={{ fontSize: "0.78rem", color: "var(--color-lime)" }}>{notice}</div>}
      {error && <div style={{ fontSize: "0.78rem", color: "var(--color-danger)" }}>{error}</div>}
    </section>
  );
};

export default VaultPanel;
