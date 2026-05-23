import React, { useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  busy: boolean;
  vaultAddress: string | null;
  controlWalletAddress: string | null;
  controlWalletLabel: string;
  walletProvider: string;
  canExportEmbeddedWallet: boolean;
  embeddedWalletRecoveryMethod: string | null;
  alreadyAcknowledged: boolean;
  acknowledgedAt: string | null;
  onClose: () => void;
  onExportEmbeddedWallet: () => Promise<void>;
  onSetEmbeddedWalletRecovery: () => Promise<void>;
  onAcknowledge: () => Promise<void>;
};

const WalletOwnershipModal: React.FC<Props> = ({
  isOpen,
  busy,
  vaultAddress,
  controlWalletAddress,
  controlWalletLabel,
  walletProvider,
  canExportEmbeddedWallet,
  embeddedWalletRecoveryMethod,
  alreadyAcknowledged,
  acknowledgedAt,
  onClose,
  onExportEmbeddedWallet,
  onSetEmbeddedWalletRecovery,
  onAcknowledge,
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleCopy = async (value: string | null, field: string) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1600);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to copy value.";
      setActionError(message);
    }
  };

  const handleExport = async () => {
    setActionError(null);
    try {
      await onExportEmbeddedWallet();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open the wallet export flow.";
      setActionError(message);
    }
  };

  const handleRecovery = async () => {
    setActionError(null);
    try {
      await onSetEmbeddedWalletRecovery();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to open the wallet recovery flow.";
      setActionError(message);
    }
  };

  const handleAcknowledge = async () => {
    setActionError(null);
    try {
      await onAcknowledge();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record the ownership acknowledgment.";
      setActionError(message);
    }
  };

  const shouldOfferRecovery = canExportEmbeddedWallet && embeddedWalletRecoveryMethod === "privy";

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "fadeIn 0.2s ease-out",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: "min(720px, 100%)",
          maxHeight: "min(92vh, 880px)",
          overflowY: "auto",
          padding: "1.4rem",
          borderRadius: "18px",
          border: "1px solid rgba(223, 246, 81, 0.22)",
          boxShadow: "0 28px 70px rgba(0, 0, 0, 0.55)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-lime)", fontWeight: 700 }}>
              Vault Ownership Handoff
            </div>
            <h2 style={{ margin: "0.25rem 0 0", fontSize: "1.35rem" }}>Your vault is ready. Secure the control wallet.</h2>
            <p style={{ margin: "0.55rem 0 0", fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Deposited funds live in the Safe vault below. The Safe itself does not have a seed phrase. Export and recovery apply to the control wallet that owns and administers that Safe.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              borderRadius: "999px",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              fontSize: "1rem",
              flexShrink: 0,
            }}
            aria-label="Close wallet ownership modal"
          >
            ×
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem" }}>
          {[
            {
              key: "vault",
              label: "Safe Vault Address",
              value: vaultAddress,
              tone: "rgba(0, 240, 255, 0.18)",
              note: "This is the onchain vault that receives and holds the deposited funds.",
            },
            {
              key: "control",
              label: controlWalletLabel,
              value: controlWalletAddress,
              tone: "rgba(223, 246, 81, 0.18)",
              note: canExportEmbeddedWallet
                ? "This Privy-managed wallet can be exported through the secure handoff flow."
                : `This ${walletProvider} wallet controls the Safe. Export or recovery must be managed in its original wallet provider.`,
            },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: "14px",
                padding: "0.95rem",
                background: "rgba(255,255,255,0.03)",
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {item.label}
                </div>
                <span style={{ width: "9px", height: "9px", borderRadius: "999px", background: item.tone, boxShadow: `0 0 16px ${item.tone}` }} />
              </div>
              <div style={{ color: "var(--text-primary)", fontFamily: "monospace", fontSize: "0.82rem", wordBreak: "break-all", minHeight: "2.4rem" }}>
                {item.value ?? "Unavailable"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.note}</div>
              <button
                onClick={() => void handleCopy(item.value, item.key)}
                disabled={!item.value}
                style={{
                  alignSelf: "flex-start",
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  color: copiedField === item.key ? "var(--color-lime)" : "var(--text-secondary)",
                  borderRadius: "999px",
                  padding: "0.38rem 0.7rem",
                  cursor: item.value ? "pointer" : "not-allowed",
                  opacity: item.value ? 1 : 0.5,
                  fontSize: "0.76rem",
                  fontWeight: 700,
                }}
              >
                {copiedField === item.key ? "Copied" : "Copy Address"}
              </button>
            </div>
          ))}
        </div>

        <div
          style={{
            border: "1px solid rgba(255, 184, 77, 0.22)",
            background: "rgba(255, 184, 77, 0.08)",
            borderRadius: "14px",
            padding: "0.9rem 1rem",
            color: "var(--text-secondary)",
            fontSize: "0.82rem",
            lineHeight: 1.6,
          }}
        >
          If you lose access to the control wallet, you lose the ability to administer the Safe. NeuralRate does not read or store your seed phrase or private key in app code.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem" }}>
          <button
            onClick={() => void handleExport()}
            disabled={!canExportEmbeddedWallet}
            style={{
              border: "none",
              background: canExportEmbeddedWallet ? "var(--color-lime)" : "rgba(255,255,255,0.08)",
              color: canExportEmbeddedWallet ? "#06110a" : "var(--text-secondary)",
              borderRadius: "10px",
              padding: "0.72rem 0.95rem",
              fontWeight: 800,
              cursor: canExportEmbeddedWallet ? "pointer" : "not-allowed",
              opacity: canExportEmbeddedWallet ? 1 : 0.7,
            }}
          >
            {canExportEmbeddedWallet ? "Export Control Wallet" : "Export Unavailable In App"}
          </button>

          {shouldOfferRecovery && (
            <button
              onClick={() => void handleRecovery()}
              style={{
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-primary)",
                borderRadius: "10px",
                padding: "0.72rem 0.95rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Configure Recovery
            </button>
          )}
        </div>

        {actionError && (
          <div style={{ fontSize: "0.78rem", color: "var(--color-danger)" }}>{actionError}</div>
        )}

        {alreadyAcknowledged ? (
          <div
            style={{
              border: "1px solid rgba(223, 246, 81, 0.18)",
              background: "rgba(223, 246, 81, 0.08)",
              borderRadius: "14px",
              padding: "0.9rem 1rem",
              color: "var(--text-secondary)",
              fontSize: "0.82rem",
              lineHeight: 1.6,
            }}
          >
            Ownership was already acknowledged{acknowledgedAt ? ` on ${new Date(acknowledgedAt).toLocaleString()}` : ""}. You can reopen this handoff anytime to review the Safe and export options again.
          </div>
        ) : (
          <label
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "flex-start",
              border: "1px solid var(--border-subtle)",
              borderRadius: "14px",
              padding: "0.9rem 1rem",
              background: "rgba(255,255,255,0.03)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              I understand that the Safe vault holds the funds, the control wallet governs that Safe, and I am responsible for exporting or securing the control wallet if I want portability or self-recovery.
            </span>
          </label>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.7rem", flexWrap: "wrap" }}>
          <button
            onClick={onClose}
            style={{
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-secondary)",
              borderRadius: "10px",
              padding: "0.7rem 0.95rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>

          {!alreadyAcknowledged && (
            <button
              onClick={() => void handleAcknowledge()}
              disabled={!confirmed || busy}
              style={{
                border: "none",
                background: "var(--color-lime)",
                color: "#06110a",
                borderRadius: "10px",
                padding: "0.7rem 1rem",
                fontWeight: 800,
                cursor: !confirmed || busy ? "not-allowed" : "pointer",
                opacity: !confirmed || busy ? 0.7 : 1,
              }}
            >
              {busy ? "Saving..." : "Acknowledge And Continue"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WalletOwnershipModal;
