import React, { useEffect, useState } from "react";
import {
  automationModeOptions,
  objectiveOptions,
  restrictionPresetOptions,
  type AgentConfig,
} from "../lib/userState";
import {
  policySyncLabel,
  shouldShowPublishPolicy,
  validatePolicyLimits,
  type PolicySyncStatus,
} from "../lib/policyLimits";

type Props = {
  config: AgentConfig | null;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
  onPublishPolicy: () => Promise<unknown>;
  policySyncStatus?: PolicySyncStatus;
};

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const AUTHORIZATION_HOURS_PER_DAY = 24;
const AUTHORIZATION_DAYS_PER_MONTH = 30;
const MAX_AUTHORIZATION_TTL_HOURS = 12 * AUTHORIZATION_DAYS_PER_MONTH * AUTHORIZATION_HOURS_PER_DAY;

const splitAuthorizationDuration = (totalHours: number) => {
  const normalizedHours = Number.isInteger(totalHours) && totalHours > 0 ? totalHours : 12;
  const hoursPerMonth = AUTHORIZATION_DAYS_PER_MONTH * AUTHORIZATION_HOURS_PER_DAY;
  const months = Math.floor(normalizedHours / hoursPerMonth);
  const remainingAfterMonths = normalizedHours % hoursPerMonth;
  return {
    authorizationMonths: months,
    authorizationDays: Math.floor(remainingAfterMonths / AUTHORIZATION_HOURS_PER_DAY),
    authorizationHours: remainingAfterMonths % AUTHORIZATION_HOURS_PER_DAY,
  };
};

const authorizationDurationToHours = (months: number, days: number, hours: number) =>
  months * AUTHORIZATION_DAYS_PER_MONTH * AUTHORIZATION_HOURS_PER_DAY +
  days * AUTHORIZATION_HOURS_PER_DAY +
  hours;

const AgentSettingsPanel: React.FC<Props> = ({ config, busy, onSave, onPublishPolicy, policySyncStatus }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Custom Select Dropdowns State
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [autoModeOpen, setAutoModeOpen] = useState(false);
  const [restrictionOpen, setRestrictionOpen] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setObjectiveOpen(false);
      setRiskOpen(false);
      setAutoModeOpen(false);
      setRestrictionOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);
  const [form, setForm] = useState({
    objective: "income",
    riskProfile: "medium",
    horizonHours: 24,
    automationMode: "auto-within-limits",
    restrictionPreset: "blue-chip-defi",
    allowedAssets: "",
    deniedAssets: "",
    allowedProtocols: "",
    deniedProtocols: "",
    maxProtocolWeightBps: 5000,
    maxAssetWeightBps: 5000,
    maxActionUsd: 1000,
    maxDailyUsd: 2500,
    maxAutomationUsd: 10000,
    maxSlippageBps: 50,
    rebalanceCadenceHours: 24,
    minSpreadOverTbillBps: 0,
    requireManualAboveUsd: 2500,
    pauseOnRiskEvent: true,
    ...splitAuthorizationDuration(12),
  });

  useEffect(() => {
    if (!config) {
      return;
    }

    setForm({
      objective: config.objective,
      riskProfile: config.risk_profile,
      horizonHours: config.horizon_hours,
      automationMode: config.automation_mode,
      restrictionPreset: config.restriction_preset,
      allowedAssets: config.allowed_assets.join(", "),
      deniedAssets: config.denied_assets.join(", "),
      allowedProtocols: config.allowed_protocols.join(", "),
      deniedProtocols: config.denied_protocols.join(", "),
      maxProtocolWeightBps: config.max_protocol_weight_bps,
      maxAssetWeightBps: config.max_asset_weight_bps,
      maxActionUsd: config.max_action_usd,
      maxDailyUsd: config.max_daily_usd,
      maxAutomationUsd: config.max_automation_usd,
      maxSlippageBps: config.max_slippage_bps,
      rebalanceCadenceHours: config.rebalance_cadence_hours,
      minSpreadOverTbillBps: config.min_spread_over_tbill_bps,
      requireManualAboveUsd: config.require_manual_above_usd,
      pauseOnRiskEvent: Boolean(config.pause_on_risk_event),
      ...splitAuthorizationDuration(config.authorization_ttl_hours ?? 12),
    });
  }, [config]);

  const save = async () => {
    const validationError = validatePolicyLimits({
      maxActionUsd: Number(form.maxActionUsd),
      maxDailyUsd: Number(form.maxDailyUsd),
      maxAutomationUsd: Number(form.maxAutomationUsd),
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const authorizationParts = [
      Number(form.authorizationMonths),
      Number(form.authorizationDays),
      Number(form.authorizationHours),
    ];
    const authorizationTtlHours = authorizationDurationToHours(
      authorizationParts[0],
      authorizationParts[1],
      authorizationParts[2]
    );
    if (
      authorizationParts.some((value) => !Number.isInteger(value) || value < 0) ||
      authorizationTtlHours < 1 ||
      authorizationTtlHours > MAX_AUTHORIZATION_TTL_HOURS
    ) {
      setFormError("Authorization duration must be between 1 hour and 12 months.");
      return;
    }
    setFormError(null);
    await onSave({
      objective: form.objective,
      riskProfile: form.riskProfile,
      horizonHours: form.horizonHours,
      automationMode: form.automationMode,
      restrictionPreset: form.restrictionPreset,
      allowedAssets: parseCsv(form.allowedAssets),
      deniedAssets: parseCsv(form.deniedAssets),
      allowedProtocols: parseCsv(form.allowedProtocols),
      deniedProtocols: parseCsv(form.deniedProtocols),
      maxProtocolWeightBps: Number(form.maxProtocolWeightBps),
      maxAssetWeightBps: Number(form.maxAssetWeightBps),
      maxActionUsd: Number(form.maxActionUsd),
      maxDailyUsd: Number(form.maxDailyUsd),
      maxAutomationUsd: Number(form.maxAutomationUsd),
      maxSlippageBps: Number(form.maxSlippageBps),
      rebalanceCadenceHours: Number(form.rebalanceCadenceHours),
      minSpreadOverTbillBps: Number(form.minSpreadOverTbillBps),
      requireManualAboveUsd: Number(form.requireManualAboveUsd),
      pauseOnRiskEvent: form.pauseOnRiskEvent,
      authorizationTtlHours,
    });
  };

  const publishPolicy = async () => {
    setFormError(null);
    await onPublishPolicy();
  };

  const showPublishPolicy = shouldShowPublishPolicy(policySyncStatus);

  return (
    <section className="glass-panel animate-enter delay-100 agent-settings-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Agent Settings</h2>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Simple presets first, advanced guardrails behind one button
          </div>
        </div>
        <button
          onClick={() => setAdvancedOpen((value) => !value)}
          style={{ background: "transparent", color: "var(--color-lime)", border: "none", cursor: "pointer", fontWeight: 700 }}
        >
          {advancedOpen ? "Hide Advanced" : "Advanced"}
        </button>
      </div>

      <div className={`agent-settings-layout ${advancedOpen ? "advanced-open" : ""}`}>
        <div className="agent-settings-primary">
          <div className="agent-settings-simple-grid">
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", position: "relative" }}>
              Objective
              <div className="custom-select-container" style={{ position: "relative", width: "100%", marginTop: "0.25rem" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setObjectiveOpen(!objectiveOpen);
                    setRiskOpen(false);
                    setAutoModeOpen(false);
                    setRestrictionOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid oklch(100% 0 0 / 0.08)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(223, 246, 81, 0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "oklch(100% 0 0 / 0.08)"}
                >
                  <span style={{ fontWeight: 600 }}>{objectiveOptions.find(o => o.value === form.objective)?.label || form.objective}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--color-lime)", transform: objectiveOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                </button>
                {objectiveOpen && (
                  <div 
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "100%",
                      marginTop: "4px",
                      background: "oklch(16% 0.012 240 / 0.95)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid oklch(100% 0 0 / 0.12)",
                      borderRadius: "8px",
                      zIndex: 50,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      overflow: "hidden",
                    }}
                  >
                    {objectiveOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setForm((current) => ({ ...current, objective: opt.value }));
                          setObjectiveOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.65rem",
                          border: "none",
                          background: form.objective === opt.value ? "rgba(223, 246, 81, 0.1)" : "transparent",
                          color: form.objective === opt.value ? "var(--color-lime)" : "var(--text-secondary)",
                          fontSize: "0.75rem",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          display: "block",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (form.objective !== opt.value) e.currentTarget.style.color = "#fff";
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          if (form.objective !== opt.value) e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.background = form.objective === opt.value ? "rgba(223, 246, 81, 0.1)" : "transparent";
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", position: "relative" }}>
              Risk Profile
              <div className="custom-select-container" style={{ position: "relative", width: "100%", marginTop: "0.25rem" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setRiskOpen(!riskOpen);
                    setObjectiveOpen(false);
                    setAutoModeOpen(false);
                    setRestrictionOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid oklch(100% 0 0 / 0.08)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(223, 246, 81, 0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "oklch(100% 0 0 / 0.08)"}
                >
                  <span style={{ fontWeight: 600 }}>{form.riskProfile}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--color-lime)", transform: riskOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                </button>
                {riskOpen && (
                  <div 
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "100%",
                      marginTop: "4px",
                      background: "oklch(16% 0.012 240 / 0.95)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid oklch(100% 0 0 / 0.12)",
                      borderRadius: "8px",
                      zIndex: 50,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      overflow: "hidden",
                    }}
                  >
                    {["low", "medium", "high"].map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          setForm((current) => ({ ...current, riskProfile: val }));
                          setRiskOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.65rem",
                          border: "none",
                          background: form.riskProfile === val ? "rgba(223, 246, 81, 0.1)" : "transparent",
                          color: form.riskProfile === val ? "var(--color-lime)" : "var(--text-secondary)",
                          fontSize: "0.75rem",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          display: "block",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (form.riskProfile !== val) e.currentTarget.style.color = "#fff";
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          if (form.riskProfile !== val) e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.background = form.riskProfile === val ? "rgba(223, 246, 81, 0.1)" : "transparent";
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              Horizon (hours)
              <input type="number" value={form.horizonHours} onChange={(event) => setForm((current) => ({ ...current, horizonHours: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
            </label>
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", display: "block", position: "relative" }}>
              Automation Mode
              <div className="custom-select-container" style={{ position: "relative", width: "100%", marginTop: "0.25rem" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setAutoModeOpen(!autoModeOpen);
                    setObjectiveOpen(false);
                    setRiskOpen(false);
                    setRestrictionOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid oklch(100% 0 0 / 0.08)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(223, 246, 81, 0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "oklch(100% 0 0 / 0.08)"}
                >
                  <span style={{ fontWeight: 600 }}>{automationModeOptions.find(o => o.value === form.automationMode)?.label || form.automationMode}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--color-lime)", transform: autoModeOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                </button>
                {autoModeOpen && (
                  <div 
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "100%",
                      marginTop: "4px",
                      background: "oklch(16% 0.012 240 / 0.95)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid oklch(100% 0 0 / 0.12)",
                      borderRadius: "8px",
                      zIndex: 50,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      overflow: "hidden",
                    }}
                  >
                    {automationModeOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setForm((current) => ({ ...current, automationMode: opt.value }));
                          setAutoModeOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.65rem",
                          border: "none",
                          background: form.automationMode === opt.value ? "rgba(223, 246, 81, 0.1)" : "transparent",
                          color: form.automationMode === opt.value ? "var(--color-lime)" : "var(--text-secondary)",
                          fontSize: "0.75rem",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          display: "block",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (form.automationMode !== opt.value) e.currentTarget.style.color = "#fff";
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          if (form.automationMode !== opt.value) e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.background = form.automationMode === opt.value ? "rgba(223, 246, 81, 0.1)" : "transparent";
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", gridColumn: "1 / -1", display: "block", position: "relative" }}>
              Restriction Preset
              <div className="custom-select-container" style={{ position: "relative", width: "100%", marginTop: "0.25rem" }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setRestrictionOpen(!restrictionOpen);
                    setObjectiveOpen(false);
                    setRiskOpen(false);
                    setAutoModeOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid oklch(100% 0 0 / 0.08)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase",
                    outline: "none",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(223, 246, 81, 0.25)"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "oklch(100% 0 0 / 0.08)"}
                >
                  <span style={{ fontWeight: 600 }}>{restrictionPresetOptions.find(o => o.value === form.restrictionPreset)?.label || form.restrictionPreset}</span>
                  <span style={{ fontSize: "0.6rem", color: "var(--color-lime)", transform: restrictionOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                </button>
                {restrictionOpen && (
                  <div 
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      width: "100%",
                      marginTop: "4px",
                      background: "oklch(16% 0.012 240 / 0.95)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid oklch(100% 0 0 / 0.12)",
                      borderRadius: "8px",
                      zIndex: 50,
                      boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                      overflow: "hidden",
                    }}
                  >
                    {restrictionPresetOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setForm((current) => ({ ...current, restrictionPreset: opt.value }));
                          setRestrictionOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.65rem",
                          border: "none",
                          background: form.restrictionPreset === opt.value ? "rgba(223, 246, 81, 0.1)" : "transparent",
                          color: form.restrictionPreset === opt.value ? "var(--color-lime)" : "var(--text-secondary)",
                          fontSize: "0.75rem",
                          textAlign: "left",
                          cursor: "pointer",
                          fontFamily: "var(--font-mono)",
                          textTransform: "uppercase",
                          display: "block",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (form.restrictionPreset !== opt.value) e.currentTarget.style.color = "#fff";
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                        }}
                        onMouseLeave={(e) => {
                          if (form.restrictionPreset !== opt.value) e.currentTarget.style.color = "var(--text-secondary)";
                          e.currentTarget.style.background = form.restrictionPreset === opt.value ? "rgba(223, 246, 81, 0.1)" : "transparent";
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="agent-settings-simple-note">
            <div className="vault-swiss-kicker">Simple Layer</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Set the portfolio objective, risk posture and automation mode here. Open `Advanced` to move the full policy guardrails into a dedicated right-side workspace.
            </div>
          </div>

          <div
            style={{
              border: "1px solid rgba(255, 255, 255, 0.075)",
              borderRadius: "12px",
              padding: "0.85rem",
              background: "transparent",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div className="vault-swiss-kicker">Policy Limits</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                  Draft limits require owner publish before becoming active on-chain.
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: showPublishPolicy ? "var(--color-lime)" : "var(--text-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "999px",
                  padding: "0.25rem 0.55rem",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {policySyncLabel(policySyncStatus)}
              </div>
            </div>
            <div className="agent-settings-simple-grid">
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Per Action (USD)
                <input type="number" min="0" value={form.maxActionUsd} onChange={(event) => setForm((current) => ({ ...current, maxActionUsd: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Daily Limit (USD)
                <input type="number" min="0" value={form.maxDailyUsd} onChange={(event) => setForm((current) => ({ ...current, maxDailyUsd: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                <div>Authorization Duration</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.4rem", marginTop: "0.25rem" }}>
                  <label>
                    <span style={{ display: "block", fontSize: "0.68rem" }}>Months</span>
                    <input
                      aria-label="Authorization Months"
                      type="number"
                      min="0"
                      max="12"
                      step="1"
                      value={form.authorizationMonths}
                      onChange={(event) => setForm((current) => ({ ...current, authorizationMonths: Number(event.target.value) }))}
                      style={{ width: "100%", marginTop: "0.2rem" }}
                    />
                  </label>
                  <label>
                    <span style={{ display: "block", fontSize: "0.68rem" }}>Days</span>
                    <input
                      aria-label="Authorization Days"
                      type="number"
                      min="0"
                      step="1"
                      value={form.authorizationDays}
                      onChange={(event) => setForm((current) => ({ ...current, authorizationDays: Number(event.target.value) }))}
                      style={{ width: "100%", marginTop: "0.2rem" }}
                    />
                  </label>
                  <label>
                    <span style={{ display: "block", fontSize: "0.68rem" }}>Hours</span>
                    <input
                      aria-label="Authorization Hours"
                      type="number"
                      min="0"
                      step="1"
                      aria-describedby="authorization-duration-help"
                      value={form.authorizationHours}
                      onChange={(event) => setForm((current) => ({ ...current, authorizationHours: Number(event.target.value) }))}
                      style={{ width: "100%", marginTop: "0.2rem" }}
                    />
                  </label>
                </div>
                <span id="authorization-duration-help" style={{ display: "block", marginTop: "0.25rem", fontSize: "0.68rem", lineHeight: 1.4 }}>
                  1 month equals 30 days. Applies to the next authorization and policy publish.
                </span>
              </div>
            </div>
            {showPublishPolicy && (
              <button
                type="button"
                onClick={() => {
                  void publishPolicy();
                }}
                disabled={busy}
                style={{
                  border: "1px solid var(--color-lime)",
                  background: "transparent",
                  color: "var(--color-lime)",
                  padding: "0.55rem 0.8rem",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: busy ? "not-allowed" : "pointer",
                  opacity: busy ? 0.7 : 1,
                  justifySelf: "start",
                }}
              >
                Publish Policy
              </button>
            )}
          </div>

          {formError && (
            <div style={{ color: "#ff9b9b", fontSize: "0.78rem", lineHeight: 1.4 }}>
              {formError}
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={form.pauseOnRiskEvent} onChange={(event) => setForm((current) => ({ ...current, pauseOnRiskEvent: event.target.checked }))} />
            Pause automation if a risk event is detected
          </label>

          <button
            onClick={() => {
              void save();
            }}
            disabled={busy}
            style={{
              border: "none",
              background: "var(--color-lime)",
              color: "#06110a",
              padding: "0.65rem 0.9rem",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "Saving..." : "Save Agent Settings"}
          </button>
        </div>

        {advancedOpen && (
          <aside className="agent-settings-advanced animate-enter">
            <div className="vault-swiss-kicker">Advanced Guardrails</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Fine tune asset allowlists, protocol constraints, action ceilings and execution tolerance without hiding the core settings.
            </div>
            <div className="agent-settings-advanced-grid">
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Allowed Assets
                <input value={form.allowedAssets} onChange={(event) => setForm((current) => ({ ...current, allowedAssets: event.target.value }))} placeholder="USDC, USDY" style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Denied Assets
                <input value={form.deniedAssets} onChange={(event) => setForm((current) => ({ ...current, deniedAssets: event.target.value }))} placeholder="METH" style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Allowed Protocols
                <input value={form.allowedProtocols} onChange={(event) => setForm((current) => ({ ...current, allowedProtocols: event.target.value }))} placeholder="Aave, Lendle" style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Denied Protocols
                <input value={form.deniedProtocols} onChange={(event) => setForm((current) => ({ ...current, deniedProtocols: event.target.value }))} placeholder="UnknownDex" style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Max Automation USD
                <input type="number" value={form.maxAutomationUsd} onChange={(event) => setForm((current) => ({ ...current, maxAutomationUsd: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Manual Approval Above
                <input type="number" value={form.requireManualAboveUsd} onChange={(event) => setForm((current) => ({ ...current, requireManualAboveUsd: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Max Protocol Weight (bps)
                <input type="number" value={form.maxProtocolWeightBps} onChange={(event) => setForm((current) => ({ ...current, maxProtocolWeightBps: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Max Asset Weight (bps)
                <input type="number" value={form.maxAssetWeightBps} onChange={(event) => setForm((current) => ({ ...current, maxAssetWeightBps: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Max Slippage (bps)
                <input type="number" value={form.maxSlippageBps} onChange={(event) => setForm((current) => ({ ...current, maxSlippageBps: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Min Spread vs T-Bill (bps)
                <input type="number" value={form.minSpreadOverTbillBps} onChange={(event) => setForm((current) => ({ ...current, minSpreadOverTbillBps: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
};

export default AgentSettingsPanel;
