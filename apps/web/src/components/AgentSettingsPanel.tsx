import React, { useEffect, useState } from "react";
import {
  automationModeOptions,
  objectiveOptions,
  restrictionPresetOptions,
  type AgentConfig,
} from "../lib/userState";

type Props = {
  config: AgentConfig | null;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
};

const parseCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const AgentSettingsPanel: React.FC<Props> = ({ config, busy, onSave }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
    });
  }, [config]);

  const save = async () => {
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
    });
  };

  return (
    <section className="glass-panel animate-enter delay-100" style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.8rem" }}>
        <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Objective
          <select value={form.objective} onChange={(event) => setForm((current) => ({ ...current, objective: event.target.value }))} style={{ width: "100%", marginTop: "0.25rem" }}>
            {objectiveOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Risk Profile
          <select value={form.riskProfile} onChange={(event) => setForm((current) => ({ ...current, riskProfile: event.target.value }))} style={{ width: "100%", marginTop: "0.25rem" }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Horizon (hours)
          <input type="number" value={form.horizonHours} onChange={(event) => setForm((current) => ({ ...current, horizonHours: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
        </label>
        <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
          Automation Mode
          <select value={form.automationMode} onChange={(event) => setForm((current) => ({ ...current, automationMode: event.target.value }))} style={{ width: "100%", marginTop: "0.25rem" }}>
            {automationModeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)", gridColumn: "1 / -1" }}>
          Restriction Preset
          <select value={form.restrictionPreset} onChange={(event) => setForm((current) => ({ ...current, restrictionPreset: event.target.value }))} style={{ width: "100%", marginTop: "0.25rem" }}>
            {restrictionPresetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {advancedOpen && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.8rem" }}>
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
            Max Action USD
            <input type="number" value={form.maxActionUsd} onChange={(event) => setForm((current) => ({ ...current, maxActionUsd: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            Max Daily USD
            <input type="number" value={form.maxDailyUsd} onChange={(event) => setForm((current) => ({ ...current, maxDailyUsd: Number(event.target.value) }))} style={{ width: "100%", marginTop: "0.25rem" }} />
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
    </section>
  );
};

export default AgentSettingsPanel;
