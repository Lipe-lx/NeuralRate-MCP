import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { AutomationState } from "../lib/userState";
import {
  DEMO_TARGET_ASSET,
  DELEGATE_VALIDATOR_ADDRESS,
  NEURALRATE_EXECUTION_GUARD_CONTRACT,
  SAFE_7579_ADAPTER_ADDRESS,
} from "../config";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  busy: boolean;
  state: AutomationState | null;
  hasFundingIntent: boolean;
  onBootstrap: () => Promise<unknown>;
  onFundingIntent: (amountUsd: number) => Promise<void>;
  onAcknowledgeOwnership: () => Promise<void>;
  onEnableAutomation: () => Promise<void>;
  onCompleteRuntimeSetup: () => Promise<void>;
  onQueueDemoStrategy: () => Promise<void>;
  controlWalletLabel: string;
  controlWalletAddress: string | null;
  canExportEmbeddedWallet: boolean;
  embeddedWalletRecoveryMethod: string | null;
  onExportEmbeddedWallet: () => Promise<void>;
  onSetEmbeddedWalletRecovery: () => Promise<void>;
  isConnected: boolean;
  isCorrectChain: boolean;
  onConnect: () => Promise<void>;
  onSwitchChain: () => Promise<void>;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  busy,
  state,
  hasFundingIntent,
  onBootstrap,
  onFundingIntent,
  onAcknowledgeOwnership,
  onEnableAutomation,
  onCompleteRuntimeSetup,
  onQueueDemoStrategy,
  controlWalletLabel,
  controlWalletAddress,
  canExportEmbeddedWallet,
  embeddedWalletRecoveryMethod,
  onExportEmbeddedWallet,
  onSetEmbeddedWalletRecovery,
  isConnected,
  isCorrectChain,
  onConnect,
  onSwitchChain,
}) => {
  const [fundingAmount, setFundingAmount] = useState(1000);
  const [confirmedOwnership, setConfirmedOwnership] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const vault = state?.vault;
  const activeGrant = state?.activeGrant;
  const isVaultCreated = Boolean(vault);
  const isOwnershipConfirmed = Boolean(vault?.ownership_acknowledged_at);
  const isGrantActive = Boolean(activeGrant && activeGrant.status === "active");
  const automationReady = Boolean(state?.automationReady);

  // Dynamic step mapping (8 steps)
  let currentStep = 1;
  if (!isConnected) {
    currentStep = 1;
  } else if (!isCorrectChain) {
    currentStep = 2;
  } else if (!isVaultCreated) {
    currentStep = 3;
  } else if (!isOwnershipConfirmed) {
    currentStep = 4;
  } else if (!hasFundingIntent) {
    currentStep = 5;
  } else if (!isGrantActive) {
    currentStep = 6;
  } else if (!automationReady) {
    currentStep = 7;
  } else {
    currentStep = 8;
  }

  const steps = [
    { num: 1, label: "Connect" },
    { num: 2, label: "Network" },
    { num: 3, label: "Welcome" },
    { num: 4, label: "Secure" },
    { num: 5, label: "Fund" },
    { num: 6, label: "Authorize" },
    { num: 7, label: "Activate" },
    { num: 8, label: "Launch" },
  ];

  const handleCopy = async (value: string | null | undefined, field: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      // Best effort only
    }
  };

  const handleCreateVault = async () => {
    setActionError(null);
    try {
      await onBootstrap();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to deploy smart account.");
    }
  };

  const handleConfirmOwnership = async () => {
    setActionError(null);
    try {
      await onAcknowledgeOwnership();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record ownership acknowledgment.");
    }
  };

  const handleSetFunding = async () => {
    setActionError(null);
    try {
      await onFundingIntent(fundingAmount);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to register funding intent.");
    }
  };

  const handleEnableAutomation = async () => {
    setActionError(null);
    try {
      await onEnableAutomation();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to authorize automation grant.");
    }
  };

  const handleCompleteRuntime = async () => {
    setActionError(null);
    try {
      await onCompleteRuntimeSetup();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to complete runtime setup.");
    }
  };

  const handleQueueDemo = async () => {
    setActionError(null);
    try {
      await onQueueDemoStrategy();
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to queue demo strategy.");
    }
  };

  // Safe modules checklist
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

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "fadeIn 0.25s ease-out",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-deep) 0%, rgba(20, 25, 22, 0.99) 100%)",
          border: "1px solid rgba(223, 246, 81, 0.18)",
          borderRadius: "20px",
          width: "94%",
          maxWidth: "600px",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "2.5rem 2rem 2rem 2rem",
          boxShadow: "0 30px 60px -15px rgba(0,0,0,0.8), 0 0 40px rgba(223,246,81,0.04)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1.2rem",
            right: "1.2rem",
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "1.5rem",
            lineHeight: 1,
            padding: "0.2rem",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          aria-label="Close wizard"
        >
          ×
        </button>

        {/* Stepper Progress Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: "1rem" }}>
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "10px",
              right: "10px",
              height: "2px",
              background: "var(--border-subtle)",
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "14px",
              left: "10px",
              width: `${((currentStep - 1) / (steps.length - 1)) * 96}%`,
              height: "2px",
              background: "var(--color-lime)",
              zIndex: 2,
              transition: "width 0.3s ease",
            }}
          />

          {steps.map((s) => {
            const isCompleted = currentStep > s.num;
            const isActive = currentStep === s.num;
            return (
              <div key={s.num} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, flex: 1 }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: isCompleted || isActive ? "var(--bg-deep)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${isCompleted || isActive ? "var(--color-lime)" : "var(--border-subtle)"}`,
                    color: isCompleted || isActive ? "var(--color-lime)" : "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    transition: "all 0.3s ease",
                    boxShadow: isActive ? "0 0 10px rgba(223, 246, 81, 0.3)" : "none",
                  }}
                >
                  {isCompleted ? "✓" : s.num}
                </div>
                <span
                  style={{
                    fontSize: "0.62rem",
                    marginTop: "0.4rem",
                    color: isActive ? "var(--color-lime)" : "var(--text-secondary)",
                    fontWeight: isActive ? 700 : 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step Body */}
        <div style={{ minHeight: "240px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {currentStep === 1 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                  <path d="M3 10h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z"></path>
                  <circle cx="16" cy="15" r="1"></circle>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Connect Your Wallet</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Welcome to NeuralRate. To start using vault automation, please connect your wallet. This EOA will act as the controller for your dedicated smart vault.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <button
                  onClick={onConnect}
                  disabled={busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.75rem 1.75rem",
                    borderRadius: "10px",
                    fontWeight: 700,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.75 : 1,
                    fontSize: "0.9rem",
                  }}
                >
                  {busy ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1 1 21.23 8h-2.67"></path>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Switch to Mantle</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                NeuralRate operates exclusively on the Mantle Sepolia network. Please switch your active wallet network to proceed.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <button
                  onClick={onSwitchChain}
                  disabled={busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.75rem 1.75rem",
                    borderRadius: "10px",
                    fontWeight: 700,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.75 : 1,
                    fontSize: "0.9rem",
                  }}
                >
                  {busy ? "Switching..." : "Switch to Mantle Sepolia"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Initialize Your Smart Vault</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                We need to bootstrap a dedicated, secure smart account (Safe) for you. This vault isolates your funds and applies custom on-chain controls.
              </p>
              <div style={{ marginTop: "1rem" }}>
                <button
                  onClick={handleCreateVault}
                  disabled={busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.75rem 1.75rem",
                    borderRadius: "10px",
                    fontWeight: 700,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.75 : 1,
                    fontSize: "0.9rem",
                  }}
                >
                  {busy ? "Deploying Vault..." : "Create User Vault"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, textAlign: "center" }}>
                Review & Confirm Ownership
              </h3>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--text-secondary)", lineHeight: 1.5, textAlign: "center" }}>
                Deposited funds live inside the smart contract vault address shown below. The vault is owned and controlled by your control wallet.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
                <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "0.8rem", background: "rgba(255,255,255,0.01)" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>Vault Address</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all", margin: "0.3rem 0" }}>{vault?.vault_address}</div>
                  <button
                    onClick={() => handleCopy(vault?.vault_address, "vault")}
                    style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: copiedField === "vault" ? "var(--color-lime)" : "var(--text-secondary)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer" }}
                  >
                    {copiedField === "vault" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "0.8rem", background: "rgba(255,255,255,0.01)" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-secondary)", textTransform: "uppercase" }}>{controlWalletLabel}</div>
                  <div style={{ fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all", margin: "0.3rem 0" }}>{controlWalletAddress}</div>
                  <button
                    onClick={() => handleCopy(controlWalletAddress, "control")}
                    style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: copiedField === "control" ? "var(--color-lime)" : "var(--text-secondary)", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", cursor: "pointer" }}
                  >
                    {copiedField === "control" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {canExportEmbeddedWallet && (
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.2rem" }}>
                  <button
                    onClick={onExportEmbeddedWallet}
                    style={{ border: "none", background: "rgba(255, 255, 255, 0.08)", color: "var(--text-primary)", padding: "0.5rem 0.8rem", borderRadius: "6px", fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    Export Control Wallet
                  </button>
                  {embeddedWalletRecoveryMethod === "privy" && (
                    <button
                      onClick={onSetEmbeddedWalletRecovery}
                      style={{ border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", padding: "0.5rem 0.8rem", borderRadius: "6px", fontSize: "0.76rem", cursor: "pointer" }}
                    >
                      Configure Recovery
                    </button>
                  )}
                </div>
              )}

              <label
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  border: "1px solid rgba(255, 184, 77, 0.15)",
                  background: "rgba(255, 184, 77, 0.04)",
                  borderRadius: "10px",
                  padding: "0.75rem",
                  cursor: "pointer",
                  marginTop: "0.4rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={confirmedOwnership}
                  onChange={(e) => setConfirmedOwnership(e.target.checked)}
                  style={{ marginTop: "0.15rem" }}
                />
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  I confirm that I hold the control wallet EOA and understand that I administer this smart vault.
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
                <button
                  onClick={handleConfirmOwnership}
                  disabled={!confirmedOwnership || busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.65rem 1.5rem",
                    borderRadius: "8px",
                    fontWeight: 700,
                    cursor: !confirmedOwnership || busy ? "not-allowed" : "pointer",
                    opacity: !confirmedOwnership || busy ? 0.6 : 1,
                    fontSize: "0.85rem",
                  }}
                >
                  {busy ? "Signing..." : "Acknowledge Ownership & Unlock"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Set Funding Intent</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Declare how much capital you intend to allocate to this vault. This guides the automated allocator without moving funds automatically.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", alignItems: "center", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-lime)" }}>$</span>
                  <input
                    type="number"
                    value={fundingAmount}
                    onChange={(e) => setFundingAmount(Math.max(1, parseInt(e.target.value) || 0))}
                    disabled={busy || hasFundingIntent}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      padding: "0.5rem 0.8rem",
                      fontSize: "1.25rem",
                      width: "120px",
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  />
                </div>
                {hasFundingIntent ? (
                  <div style={{ color: "var(--color-lime)", fontSize: "0.9rem", fontWeight: 600 }}>
                    ✓ Funding intent registered!
                  </div>
                ) : (
                  <button
                    onClick={handleSetFunding}
                    disabled={busy}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--color-lime)",
                      color: "var(--color-lime)",
                      padding: "0.6rem 1.5rem",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: busy ? "not-allowed" : "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {busy ? "Registering..." : "Confirm Funding Intent"}
                  </button>
                )}
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Enable Vault Automation</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Issue a scoped automation grant from your control wallet to authorize the operator agent to execute strategy reallocations within your configured policy limits.
              </p>
              <div style={{ marginTop: "0.8rem" }}>
                <button
                  onClick={handleEnableAutomation}
                  disabled={busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.7rem 1.5rem",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Enabling..." : "Enable Vault Automation"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, textAlign: "center" }}>
                Activate Safe Module Runtime
              </h3>
              <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-secondary)", lineHeight: 1.5, textAlign: "center" }}>
                Finish the Safe 7579 module and execution guard setup transactions to activate the agent executor.
              </p>

              <div
                style={{
                  display: "grid",
                  gap: "0.45rem",
                  background: "rgba(255,255,255,0.01)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "0.85rem",
                }}
              >
                {runtimeChecklist.map((step) => (
                  <div
                    key={step.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.78rem",
                      color: step.done ? "var(--color-lime)" : "var(--text-secondary)",
                    }}
                  >
                    <span>{step.label}</span>
                    <span style={{ fontWeight: 700 }}>{step.done ? "Done ✓" : "Pending"}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
                <button
                  onClick={handleCompleteRuntime}
                  disabled={busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.7rem 1.5rem",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? `Finishing (${completedRuntimeSteps}/${runtimeStepCount})...` : "Finish Runtime Setup"}
                </button>
              </div>
            </div>
          )}

          {currentStep === 8 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Vault Fully Operational!</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Your smart vault, control policies, and Safe runtime are successfully activated. The operator agent can now run fully automated transactions.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1rem" }}>
                <button
                  onClick={handleQueueDemo}
                  disabled={busy}
                  style={{
                    background: "var(--color-lime)",
                    border: "none",
                    color: "#06110a",
                    padding: "0.7rem 1.5rem",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    cursor: busy ? "not-allowed" : "pointer",
                  }}
                >
                  {busy ? "Queueing Demo..." : `Queue ${DEMO_TARGET_ASSET} Strategy`}
                </button>
                <button
                  onClick={onClose}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    padding: "0.7rem 1.5rem",
                    borderRadius: "8px",
                    fontSize: "0.88rem",
                    cursor: "pointer",
                  }}
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Strip */}
        {actionError && (
          <div
            style={{
              padding: "0.6rem 0.8rem",
              background: "rgba(255, 77, 77, 0.08)",
              border: "1px solid rgba(255, 77, 77, 0.2)",
              borderRadius: "8px",
              color: "var(--color-danger)",
              fontSize: "0.78rem",
              lineHeight: 1.4,
            }}
          >
            {actionError}
          </div>
        )}

        {/* Dynamic Nav Hints */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1.2rem", fontSize: "0.74rem", color: "var(--text-secondary)" }}>
          <span>Step {currentStep} of {steps.length}</span>
          <span>Status: {busy ? "Executing transaction..." : "Idle"}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingWizard;
