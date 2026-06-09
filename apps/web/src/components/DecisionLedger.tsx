import React, { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  ERC8004_AGENT_ID,
  ERC8004_IDENTITY_REGISTRY,
  MANTLE_EXPLORER_BASE_URL,
  NEURALRATE_AGENT_SMART_WALLET,
  NEURALRATE_BENCHMARK_CONTRACT,
} from "../config";
import { clearStoredMcpAccessBundle, loadStoredMcpAccessBundle } from "../lib/mcpAccess";
import { authorizedGetJsonFetch, signedGetJsonFetch, signedJsonFetch } from "../lib/auth";
import { buildLocalSnapshotHash } from "../lib/policyRegistry";
import type { AutomationState, DecisionRecord } from "../lib/userState";
import { useWalletContext } from "../context/WalletContext";

type Props = {
  state: AutomationState | null;
  busy: boolean;
  onRefreshAutomation: () => Promise<unknown>;
};

type AllocationResponse = {
  amountAllocated: number;
  objective: string;
  riskProfile: string;
  horizon: number;
  automationMode: string;
  restrictionPreset: string;
  allocations: Array<{
    asset: string;
    protocol: string;
    allocationPercentage: number;
    allocationUsd: number;
    expectedApy: number;
    expectedSpreadBps: number;
    stablecoin: boolean;
    rankingScore: number;
  }>;
  blendedPredictedApy: number;
  tbillSpreadBps: number;
  appliedConstraints: Record<string, unknown>;
  rationale: Record<string, unknown>;
  automationEligibility: {
    mode: string;
    eligible: boolean;
    maxActionUsd: number;
    reason: string;
  };
};

const statusStyles: Record<string, { label: string; background: string; color: string }> = {
  local: {
    label: "LOCAL",
    background: "rgba(255,255,255,0.08)",
    color: "var(--text-secondary)",
  },
  pending: {
    label: "PENDING",
    background: "rgba(255, 184, 77, 0.12)",
    color: "var(--color-warning)",
  },
  onchain: {
    label: "ON-CHAIN",
    background: "rgba(223, 246, 81, 0.12)",
    color: "var(--color-lime)",
  },
};

const truncate = (value: string) => (value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value);

const parseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);

const decisionsCache: Record<string, DecisionRecord[]> = {};

const DecisionLedger: React.FC<Props> = ({ state, busy, onRefreshAutomation }) => {
  const wallet = useWalletContext();
  const [amountUsd, setAmountUsd] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [queueing, setQueueing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ownerEoa = state?.ownerEoa ?? null;
  const hasVault = Boolean(state?.vault?.vault_id);
  const hasConfig = Boolean(state?.config);
  const isRecommendOnlyPath = !hasVault;

  const storedBundle = useMemo(() => ownerEoa ? loadStoredMcpAccessBundle(ownerEoa) : null, [ownerEoa]);
  const hasSession = Boolean(storedBundle?.sessionToken);

  const [decisions, setDecisions] = useState<DecisionRecord[]>(() => {
    if (ownerEoa) {
      return decisionsCache[ownerEoa.toLowerCase()] ?? [];
    }
    return [];
  });

  const fetchHistory = async (force = false) => {
    if (!ownerEoa) {
      setDecisions([]);
      return;
    }

    if (!hasSession && !force) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let json: { success: boolean; decisions: DecisionRecord[] };
      try {
        json = await authorizedGetJsonFetch<{ success: boolean; decisions: DecisionRecord[] }>({
          ownerEoa,
          signMessage: wallet.signMessage,
          url: `${API_BASE_URL}/benchmark/history?ownerEoa=${encodeURIComponent(ownerEoa)}&limit=25`,
          sessionToken: storedBundle?.sessionToken ?? null,
        });
      } catch (sessionError) {
        if (!storedBundle?.sessionToken) {
          throw sessionError;
        }

        clearStoredMcpAccessBundle(ownerEoa);
        json = await signedGetJsonFetch<{ success: boolean; decisions: DecisionRecord[] }>({
          ownerEoa,
          signMessage: wallet.signMessage,
          url: `${API_BASE_URL}/benchmark/history?ownerEoa=${encodeURIComponent(ownerEoa)}&limit=25`,
        });
      }
      setDecisions(json.decisions);
      decisionsCache[ownerEoa.toLowerCase()] = json.decisions;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load benchmark history.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = ownerEoa ? decisionsCache[ownerEoa.toLowerCase()] : null;
    if (cached) {
      setDecisions(cached);
    } else {
      setDecisions([]);
    }

    if (hasSession) {
      void fetchHistory(false);
    }
  }, [ownerEoa, hasSession]);

  useEffect(() => {
    if (state?.config?.max_automation_usd) {
      setAmountUsd(Math.min(10000, state.config.max_automation_usd));
    }
  }, [state?.config?.max_automation_usd]);

  const generateDecision = async () => {
    if (!ownerEoa || !state?.config) {
      setError("Connect your wallet and save agent settings before generating a decision.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const allocationResponse = await fetch(`${API_BASE_URL}/allocation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountUsd,
          objective: state.config.objective,
          riskProfile: state.config.risk_profile,
          horizonHours: state.config.horizon_hours,
          allowedAssets: state.config.allowed_assets,
          deniedAssets: state.config.denied_assets,
          allowedProtocols: state.config.allowed_protocols,
          deniedProtocols: state.config.denied_protocols,
          maxProtocolWeightBps: state.config.max_protocol_weight_bps,
          maxAssetWeightBps: state.config.max_asset_weight_bps,
          maxActionUsd: state.config.max_action_usd,
          stableOnly: state.config.restriction_preset === "stable-only",
          minSpreadOverTbillBps: state.config.min_spread_over_tbill_bps,
          automationMode: state.config.automation_mode,
          restrictionPreset: state.config.restriction_preset,
        }),
      });

      if (!allocationResponse.ok) {
        throw new Error(`Allocation request failed: ${allocationResponse.status}`);
      }

      const allocation = (await allocationResponse.json()) as AllocationResponse;
      const decisionId = `decision_${crypto.randomUUID()}`;
      const predictedApyBps = Math.round(allocation.blendedPredictedApy * 100);
      const snapshotPayload = {
        decisionId,
        ownerEoa,
        amountUsd,
        objective: allocation.objective,
        riskProfile: allocation.riskProfile,
        allocations: allocation.allocations,
        constraints: allocation.appliedConstraints,
        rationale: allocation.rationale,
      };
      const snapshotHash = buildLocalSnapshotHash(snapshotPayload);

      await signedJsonFetch({
        ownerEoa,
        signMessage: wallet.signMessage,
        url: `${API_BASE_URL}/decisions`,
        method: "POST",
        body: {
          ownerEoa,
          decisionId,
          agentAddress: NEURALRATE_AGENT_SMART_WALLET,
          requestedBy: ownerEoa,
          dataSnapshotHash: snapshotHash,
          predictedApyBps,
          benchmarkRateBps: predictedApyBps - allocation.tbillSpreadBps,
          riskProfile: allocation.riskProfile,
          settlementHorizonHours: allocation.horizon,
          allocationJson: JSON.stringify(allocation.allocations),
          benchmarkStatus: "local",
          userId: state.userId,
          vaultId: state.vault?.vault_id ?? null,
          policyVersion: state.config?.policy_version ?? "recommend-only-v1",
          objective: allocation.objective,
          automationMode: state.vault ? allocation.automationMode : "recommend-only",
          appliedConstraintsJson: JSON.stringify(allocation.appliedConstraints),
          rationaleJson: JSON.stringify({
            ...allocation.rationale,
            automationEligibility: allocation.automationEligibility,
            snapshotLineage: {
              method: "keccak256(canonical-json-v1)",
              payload: snapshotPayload,
              hash: snapshotHash,
              snapshotCid: `inline-rationale:${decisionId}`,
            },
          }),
        },
      });

      setNotice(
        allocation.automationEligibility.eligible
          ? "Decision generated. It fits the user vault limits and can be queued for autonomous benchmarking."
          : "Decision generated. It remains advisory until you loosen the current action limits."
      );
      await fetchHistory(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate decision.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const queueBenchmark = async (decision: DecisionRecord) => {
    if (!ownerEoa || !state?.activeGrant) {
      setError("Enable automation before queueing benchmark execution.");
      return;
    }

    setQueueing(decision.decision_id);
    setError(null);

    try {
      const dataSnapshotHash =
        decision.data_snapshot_hash ||
        `vault-${state.vault?.vault_id || "unknown"}-${decision.decision_id.slice(-6)}`;

      const json = await signedJsonFetch<{
        success: boolean;
        benchmarkJob: {
          benchmark_job_id: string;
          status: string;
          failure_reason?: string | null;
        };
        executionCapable: boolean;
      }>({
        ownerEoa,
        signMessage: wallet.signMessage,
        url: `${API_BASE_URL}/benchmark-jobs`,
        method: "POST",
        body: {
          decisionId: decision.decision_id,
          ownerEoa,
          dataSnapshotHash,
          payload: {
            vaultId: state.vault?.vault_id,
            policyVersion: state.config?.policy_version,
            strategyKey: "optimal-allocation",
            snapshotHash: dataSnapshotHash,
            snapshotCid: `local-snapshot:${dataSnapshotHash}`,
            benchmarkContract: NEURALRATE_BENCHMARK_CONTRACT,
            agentRegistry: ERC8004_IDENTITY_REGISTRY,
            agentId: ERC8004_AGENT_ID,
            predictedApyBps: decision.predicted_apy_bps,
            settlementHorizonHours: decision.settlement_horizon_hours,
          },
        },
      });

      setNotice(
        json.executionCapable
          ? `Benchmark job ${truncate(json.benchmarkJob.benchmark_job_id)} submitted and awaiting confirmation.`
          : `Benchmark job ${truncate(json.benchmarkJob.benchmark_job_id)} recorded, but execution is unavailable for the current signer mode.`
      );
      await onRefreshAutomation();
      await fetchHistory(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to queue benchmark.";
      setError(message);
    } finally {
      setQueueing(null);
    }
  };

  const activeJobByDecision = useMemo(
    () => new Map((state?.benchmarkJobs ?? []).map((job) => [job.decision_id, job])),
    [state?.benchmarkJobs]
  );

  const queuedCount = decisions.filter((decision) => decision.benchmark_status === "pending" || decision.benchmark_status === "onchain").length;
  const latestDecision = decisions[0] ?? null;

  return (
    <section className="glass-panel animate-enter delay-150 decision-ledger-panel">
      <div className="decision-ledger-layout">
        <div className="decision-ledger-control">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Benchmark History</h2>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
                Personalized decisions with a recommend-first flow and optional vault automation
              </div>
            </div>
            <button
              onClick={() => {
                void generateDecision();
              }}
              disabled={loading || busy || !hasConfig}
              style={{
                border: "none",
                background: "var(--color-lime)",
                color: "#06110a",
                padding: "0.65rem 0.9rem",
                borderRadius: "8px",
                fontWeight: 700,
                cursor: loading || busy ? "not-allowed" : "pointer",
                opacity: loading || busy ? 0.7 : 1,
                flexShrink: 0,
              }}
            >
              {loading ? "Generating..." : "Generate Decision"}
            </button>
          </div>

          <div className="decision-ledger-summary-grid">
            <div className="decision-ledger-summary-card accent">
              <div className="vault-swiss-kicker">Recorded Decisions</div>
              <div className="decision-ledger-summary-value">{decisions.length}</div>
              <div className="decision-ledger-summary-note">
                {hasVault
                  ? "Every benchmark candidate generated for this vault."
                  : "Recommendations generated before vault setup."}
              </div>
            </div>
            <div className="decision-ledger-summary-card">
              <div className="vault-swiss-kicker">Queued / Onchain</div>
              <div className="decision-ledger-summary-value">{queuedCount}</div>
              <div className="decision-ledger-summary-note">Decisions already moving through autonomous execution.</div>
            </div>
            <div className="decision-ledger-summary-card">
              <div className="vault-swiss-kicker">Latest APY</div>
              <div className="decision-ledger-summary-value">
                {latestDecision ? `${(latestDecision.predicted_apy_bps / 100).toFixed(2)}%` : "0.00%"}
              </div>
              <div className="decision-ledger-summary-note">
                {latestDecision ? `Last recorded ${new Date(latestDecision.created_at).toLocaleDateString()}` : "Generate the first decision to start the feed."}
              </div>
            </div>
          </div>

          <div className="decision-ledger-config-card">
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.75rem", alignItems: "start" }}>
              <label style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Target Size (USD)
                <input type="number" value={amountUsd} onChange={(event) => setAmountUsd(Number(event.target.value))} style={{ width: "100%", marginTop: "0.25rem" }} />
              </label>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {isRecommendOnlyPath
                  ? "NeuralRate can generate recommendations immediately. Create a vault later to turn these decisions into autonomous benchmark jobs."
                  : "NeuralRate reads global Mantle yield data, then ranks opportunities inside this user's vault policy. No shared treasury is used across users."}
              </div>
            </div>
          </div>

          <div className="decision-ledger-link-row">
            <a href={`${MANTLE_EXPLORER_BASE_URL}/address/${NEURALRATE_BENCHMARK_CONTRACT}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-lime)" }}>
              Benchmark Contract
            </a>
            <a href={`${MANTLE_EXPLORER_BASE_URL}/address/${ERC8004_IDENTITY_REGISTRY}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-lime)" }}>
              ERC-8004 Registry
            </a>
            <span style={{ color: "var(--text-secondary)" }}>Agent ID {ERC8004_AGENT_ID}</span>
          </div>

          {(notice || error) && (
            <div className="decision-ledger-feedback">
              {notice && <div style={{ color: "var(--color-lime)" }}>{notice}</div>}
              {error && <div style={{ color: "var(--color-danger)" }}>{error}</div>}
            </div>
          )}
        </div>

        <aside className="decision-ledger-history organic-col-divider">
          <div className="decision-ledger-history-header">
            <div>
              <div className="vault-swiss-kicker">Decision Feed</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.18rem" }}>
                The most recent benchmark records stay pinned on the right.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
                {decisions.length} record{decisions.length === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => void fetchHistory(true)}
                disabled={loading}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-lime)",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: "0.74rem",
                  padding: "0.2rem 0.4rem",
                  borderRadius: "4px",
                  textDecoration: "underline",
                }}
              >
                {loading ? "Syncing..." : hasSession ? "Sync" : "Sync (Sign)"}
              </button>
            </div>
          </div>

          <div className="decision-ledger-history-list">
            {decisions.map((decision) => {
              const allocations = parseJson<
                Array<{ asset: string; protocol: string; allocationPercentage: number; allocationUsd?: number }>
              >(decision.allocation_json, []);
              const constraints = parseJson<Record<string, unknown>>(decision.applied_constraints_json, {});
              const job = activeJobByDecision.get(decision.decision_id);
              const status = statusStyles[decision.benchmark_status || "local"] || statusStyles.local;

              return (
                <article
                  key={decision.decision_id}
                  className="decision-ledger-entry"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{truncate(decision.decision_id)}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        {decision.objective || "income"} • {decision.risk_profile} • {new Date(decision.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span
                      style={{
                        background: status.background,
                        color: status.color,
                        padding: "0.25rem 0.5rem",
                        borderRadius: "999px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    <div>Predicted APY: <strong style={{ color: "var(--text-primary)" }}>{(decision.predicted_apy_bps / 100).toFixed(2)}%</strong></div>
                    <div>Target: <strong style={{ color: "var(--text-primary)" }}>{formatUsd(Number(allocations.reduce((sum, item) => sum + (item.allocationUsd ?? 0), 0)))}</strong></div>
                    <div>Vault: <strong style={{ color: "var(--text-primary)" }}>{truncate(decision.vault_id || "n/a")}</strong></div>
                    <div>Mode: <strong style={{ color: "var(--text-primary)" }}>{decision.automation_mode || "recommend-only"}</strong></div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                    {allocations.map((allocation, index) => (
                      <span key={`${decision.decision_id}-${index}`} style={{ fontSize: "0.74rem", background: "rgba(255,255,255,0.06)", borderRadius: "999px", padding: "0.28rem 0.55rem", color: "var(--text-secondary)" }}>
                        {allocation.asset} / {allocation.protocol} • {allocation.allocationPercentage.toFixed(1)}%
                      </span>
                    ))}
                  </div>

                  <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                    Applied restrictions: {String(constraints.policyVersion || decision.policy_version || "vault-v1")} · max action ${String(constraints.maxActionUsd || state?.config?.max_action_usd || "n/a")}
                  </div>

                  {(decision.tx_hash || job?.tx_hash || job?.onchain_decision_id) && (
                    <div style={{ fontSize: "0.76rem", color: "var(--text-secondary)", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      {(job?.tx_hash || decision.tx_hash) && (
                        <a
                          href={`${MANTLE_EXPLORER_BASE_URL}/tx/${job?.tx_hash || decision.tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--color-lime)" }}
                        >
                          Tx {truncate(job?.tx_hash || decision.tx_hash || "")}
                        </a>
                      )}
                      {job?.onchain_decision_id && (
                        <span>On-chain Decision #{job.onchain_decision_id}</span>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "0.76rem", color: job?.failure_reason ? "var(--color-warning)" : "var(--text-secondary)" }}>
                      {job ? `Job ${truncate(job.benchmark_job_id)} • ${job.status}` : "Not queued for autonomous benchmarking yet."}
                    </div>
                    <button
                      onClick={() => {
                        void queueBenchmark(decision);
                      }}
                      disabled={busy || queueing === decision.decision_id || !state?.activeSession}
                      style={{
                        border: "1px solid var(--border-subtle)",
                        background: "transparent",
                        color: "var(--text-primary)",
                        padding: "0.45rem 0.75rem",
                        borderRadius: "8px",
                        cursor: busy || queueing === decision.decision_id || !state?.activeSession ? "not-allowed" : "pointer",
                        opacity: busy || queueing === decision.decision_id || !state?.activeSession ? 0.65 : 1,
                      }}
                    >
                      {queueing === decision.decision_id ? "Queueing..." : "Queue Auto Benchmark"}
                    </button>
                  </div>
                </article>
              );
            })}

            {!loading && decisions.length === 0 && (
              <div className="decision-ledger-empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                <div>
                  {hasVault
                    ? "No personalized decisions yet. Save settings and generate the first benchmark decision."
                    : "No recommendations yet. Generate your first decision now, then bootstrap a vault when you're ready for automation."}
                </div>
                {!hasSession && (
                  <button
                    onClick={() => void fetchHistory(true)}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--text-primary)",
                      padding: "0.5rem 1rem",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                    }}
                  >
                    Sync History from Server
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default DecisionLedger;
