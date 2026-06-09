import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  busy: boolean;
  vault: any;
  hasFundingIntent: boolean;
  onBootstrap: () => Promise<unknown>;
  onFundingIntent: (amountUsd: number) => Promise<void>;
  controlWalletLabel: string;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  busy,
  vault,
  hasFundingIntent,
  onBootstrap,
  onFundingIntent,
  controlWalletLabel,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [fundingAmount, setFundingAmount] = useState(1000);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-advance if state changes in the background
  useEffect(() => {
    if (vault && currentStep === 2) {
      setCurrentStep(3);
    }
  }, [vault, currentStep]);

  useEffect(() => {
    if (hasFundingIntent && currentStep === 3) {
      setCurrentStep(4);
    }
  }, [hasFundingIntent, currentStep]);

  if (!isOpen || !mounted) return null;

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateVault = async () => {
    try {
      await onBootstrap();
    } catch (err) {
      console.error("Bootstrap failed in wizard:", err);
    }
  };

  const handleSetFunding = async () => {
    try {
      await onFundingIntent(fundingAmount);
    } catch (err) {
      console.error("Funding intent failed in wizard:", err);
    }
  };

  const steps = [
    { num: 1, label: "Welcome" },
    { num: 2, label: "Create Vault" },
    { num: 3, label: "Set Funding" },
    { num: 4, label: "Activate" },
  ];

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        animation: "fadeIn 0.25s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-deep) 0%, rgba(20, 25, 22, 0.98) 100%)",
          border: "1px solid rgba(223, 246, 81, 0.15)",
          borderRadius: "20px",
          width: "92%",
          maxWidth: "540px",
          padding: "2.5rem 2rem 2rem 2rem",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px rgba(223,246,81,0.03)",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          color: "var(--text-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
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

        {/* Stepper Header */}
        <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: "1rem" }}>
          {/* Connector Line */}
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
              <div
                key={s.num}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  zIndex: 3,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: isCompleted || isActive ? "var(--bg-deep)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${isCompleted || isActive ? "var(--color-lime)" : "var(--border-subtle)"}`,
                    color: isCompleted || isActive ? "var(--color-lime)" : "var(--text-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    transition: "all 0.3s ease",
                    boxShadow: isActive ? "0 0 10px rgba(223, 246, 81, 0.3)" : "none",
                  }}
                >
                  {isCompleted ? "✓" : s.num}
                </div>
                <span
                  style={{
                    fontSize: "0.68rem",
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
        <div style={{ minHeight: "220px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {currentStep === 1 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>Initialize Your Smart Vault</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Welcome to NeuralRate. To start using vault automation, we need to bootstrap a dedicated, secure multi-sig account (Safe) for you. This vault isolates your funds and applies custom on-chain controls.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Deploy Smart Account</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                This creates an isolated smart contract wallet on-chain. Your {controlWalletLabel.toLowerCase()} acts as the master owner. The operator agent can only execute within rules you sign.
              </p>
              {vault ? (
                <div style={{ color: "var(--color-lime)", fontSize: "0.9rem", fontWeight: 600 }}>
                  ✓ Vault successfully created! Address: {vault.vault_address}
                </div>
              ) : (
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    onClick={handleCreateVault}
                    disabled={busy}
                    style={{
                      background: "var(--color-lime)",
                      border: "none",
                      color: "#06110a",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "10px",
                      fontWeight: 700,
                      cursor: busy ? "not-allowed" : "pointer",
                      opacity: busy ? 0.75 : 1,
                      fontSize: "0.9rem",
                      transition: "transform 0.15s ease",
                    }}
                  >
                    {busy ? "Bootstrapping Vault..." : "Create User Vault"}
                  </button>
                </div>
              )}
            </div>
          )}

          {currentStep === 3 && (
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
                      padding: "0.6rem 1.2rem",
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

          {currentStep === 4 && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-lime)" strokeWidth="1.5">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Vault Prepared!</h3>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Your smart vault and funding intent are configured. To let the agent manage strategies, you will need to:
              </p>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  textAlign: "left",
                  background: "rgba(255,255,255,0.02)",
                  padding: "0.8rem 1.2rem",
                  borderRadius: "10px",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <span style={{ color: "var(--color-lime)" }}>✦</span>
                  <span>Review & confirm wallet ownership</span>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <span style={{ color: "var(--color-lime)" }}>✦</span>
                  <span>Enable automation & activate runtime</span>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <span style={{ color: "var(--color-lime)" }}>✦</span>
                  <span>Queue target strategies</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1.2rem" }}>
          <button
            onClick={handlePrev}
            disabled={currentStep === 1 || busy}
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              color: currentStep === 1 ? "var(--text-muted)" : "var(--text-secondary)",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              fontSize: "0.82rem",
              cursor: currentStep === 1 || busy ? "not-allowed" : "pointer",
              opacity: currentStep === 1 ? 0.4 : 1,
            }}
          >
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={
                busy ||
                (currentStep === 2 && !vault) ||
                (currentStep === 3 && !hasFundingIntent)
              }
              style={{
                background: "var(--color-lime)",
                border: "none",
                color: "#06110a",
                padding: "0.5rem 1.2rem",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor:
                  busy ||
                  (currentStep === 2 && !vault) ||
                  (currentStep === 3 && !hasFundingIntent)
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  busy ||
                  (currentStep === 2 && !vault) ||
                  (currentStep === 3 && !hasFundingIntent)
                    ? 0.5
                    : 1,
              }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={onClose}
              style={{
                background: "var(--color-lime)",
                border: "none",
                color: "#06110a",
                padding: "0.5rem 1.2rem",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingWizard;
