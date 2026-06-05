import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, MCP_HTTP_URL, MANTLE_CHAIN_ID, MANTLE_EXPLORER_BASE_URL, SSE_URL } from "../config";

type DeploymentRecord = {
  network?: string;
  chainId?: number;
  contractName?: string;
  address?: string;
  txHash?: string;
  updatedAt?: string;
};

type VerificationBundle = {
  generatedAt: string;
  deployments: Record<string, DeploymentRecord>;
  summary: {
    benchmark: DeploymentRecord | null;
    policyRegistry: DeploymentRecord | null;
    executionGuard: DeploymentRecord | null;
    vaultModule: DeploymentRecord | null;
  };
};

type AgentCard = {
  name?: string;
  services?: Array<{ endpoint?: string; version?: string }>;
  registrations?: Array<{ agentRegistry?: string; agentId?: string }>;
};

type HealthPayload = {
  ok: boolean;
  envProfile?: string;
  env?: Record<string, unknown>;
  timestamp?: string;
};

const truncate = (value?: string) =>
  value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "n/a";

const explorerAddress = (address?: string) =>
  address ? `${MANTLE_EXPLORER_BASE_URL}/address/${address}` : "#";

const explorerTx = (txHash?: string) =>
  txHash ? `${MANTLE_EXPLORER_BASE_URL}/tx/${txHash}` : "#";

const VerifyPanel: React.FC = () => {
  const [bundle, setBundle] = useState<VerificationBundle | null>(null);
  const [agentCard, setAgentCard] = useState<AgentCard | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [telemetrySummary, setTelemetrySummary] = useState<Array<{ level?: string; count?: number }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError(null);
      try {
        const [bundleResponse, cardResponse, healthResponse, telemetryResponse] = await Promise.all([
          fetch("/verify/deployments.json"),
          fetch("/verify/agent-card.json"),
          fetch(`${API_BASE_URL}/health`),
          fetch(`${API_BASE_URL}/telemetry/summary`),
        ]);

        if (!bundleResponse.ok) {
          throw new Error(`Failed to load verification bundle: ${bundleResponse.status}`);
        }
        if (!cardResponse.ok) {
          throw new Error(`Failed to load agent card: ${cardResponse.status}`);
        }

        const bundleJson = (await bundleResponse.json()) as VerificationBundle;
        const cardJson = (await cardResponse.json()) as AgentCard;
        const healthJson = healthResponse.ok ? ((await healthResponse.json()) as HealthPayload) : null;
        const telemetryJson = telemetryResponse.ok ? ((await telemetryResponse.json()) as { last24h?: Array<{ level?: string; count?: number }> }) : null;
        if (!mounted) {
          return;
        }

        setBundle(bundleJson);
        setAgentCard(cardJson);
        setHealth(healthJson);
        setTelemetrySummary(telemetryJson?.last24h ?? null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load verification data.");
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const contracts = useMemo(() => {
    if (!bundle?.summary) {
      return [];
    }
    return [
      { label: "Decision Receipt Registry", value: bundle.summary.benchmark },
      { label: "Policy Registry", value: bundle.summary.policyRegistry },
      { label: "Execution Guard", value: bundle.summary.executionGuard },
      { label: "Vault Module", value: bundle.summary.vaultModule },
    ];
  }, [bundle]);

  const service = agentCard?.services?.[0] ?? null;
  const registration = agentCard?.registrations?.[0] ?? null;
  const canonicalEndpoint = service?.endpoint || MCP_HTTP_URL;
  const mcpConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            neuralrate: {
              type: "http",
              url: canonicalEndpoint,
            },
          },
        },
        null,
        2
      ),
    [canonicalEndpoint]
  );
  const legacySseConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            neuralrate: {
              type: "sse",
              url: SSE_URL,
            },
          },
        },
        null,
        2
      ),
    []
  );
  const policySummary = useMemo(
    () =>
      JSON.stringify(
        {
          chainId: bundle?.summary?.benchmark?.chainId ?? MANTLE_CHAIN_ID,
          policyRegistry: bundle?.summary?.policyRegistry?.address ?? null,
          executionGuard: bundle?.summary?.executionGuard?.address ?? null,
          vaultModule: bundle?.summary?.vaultModule?.address ?? null,
          benchmarkRegistry: bundle?.summary?.benchmark?.address ?? null,
        },
        null,
        2
      ),
    [bundle]
  );

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <section className="glass-panel animate-enter" style={{ padding: "1.1rem", minHeight: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Verification</h2>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
            Public proof surface for deployments, MCP endpoint and agent identity.
          </div>
        </div>
        <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>
          Generated: {bundle?.generatedAt ? new Date(bundle.generatedAt).toLocaleString() : "loading..."}
        </div>
      </div>

      {error && <div style={{ color: "var(--color-danger)", marginBottom: "1rem", fontSize: "0.82rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.8rem", marginBottom: "1rem" }}>
        <div className="decision-ledger-summary-card">
          <div className="vault-swiss-kicker">Chain</div>
          <div className="decision-ledger-summary-value">{bundle?.summary?.benchmark?.chainId ?? MANTLE_CHAIN_ID}</div>
          <div className="decision-ledger-summary-note">Mantle Sepolia</div>
        </div>
        <div className="decision-ledger-summary-card">
          <div className="vault-swiss-kicker">MCP Endpoint</div>
          <div className="decision-ledger-summary-value" style={{ fontSize: "0.95rem" }}>
            {truncate(canonicalEndpoint)}
          </div>
          <div className="decision-ledger-summary-note">Worker public surface</div>
        </div>
        <div className="decision-ledger-summary-card">
          <div className="vault-swiss-kicker">Runtime Health</div>
          <div className="decision-ledger-summary-value" style={{ fontSize: "0.95rem" }}>
            {health?.ok ? "Healthy" : "Unknown"}
          </div>
          <div className="decision-ledger-summary-note">Profile {health?.envProfile || "n/a"}</div>
        </div>
        <div className="decision-ledger-summary-card">
          <div className="vault-swiss-kicker">Telemetry (24h)</div>
          <div className="decision-ledger-summary-value" style={{ fontSize: "0.95rem" }}>
            {(telemetrySummary ?? []).reduce((acc, curr) => acc + Number(curr.count || 0), 0)}
          </div>
          <div className="decision-ledger-summary-note">Captured web/worker runtime events</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginBottom: "1rem" }}>
        {contracts.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.55rem 0.65rem", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
            <div>
              <div style={{ color: "var(--text-primary)", fontSize: "0.84rem", fontWeight: 700 }}>{item.label}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem" }}>{item.value?.contractName || "n/a"}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
              <div>
                <a href={explorerAddress(item.value?.address)} target="_blank" rel="noreferrer" style={{ color: "var(--color-lime)" }}>
                  {truncate(item.value?.address)}
                </a>
              </div>
              <div>
                <a href={explorerTx(item.value?.txHash)} target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)" }}>
                  tx {truncate(item.value?.txHash)}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
        <div>Agent Name: <strong style={{ color: "var(--text-primary)" }}>{agentCard?.name || "NeuralRate MCP Agent"}</strong></div>
        <div>Service Version: <strong style={{ color: "var(--text-primary)" }}>{service?.version || "n/a"}</strong></div>
        <div>Agent ID: <strong style={{ color: "var(--text-primary)" }}>{registration?.agentId || "n/a"}</strong></div>
        <div>Registry: <strong style={{ color: "var(--text-primary)" }}>{registration?.agentRegistry ? truncate(registration.agentRegistry) : "n/a"}</strong></div>
      </div>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
        <a href="/verify/deployments.json" target="_blank" rel="noreferrer" style={{ color: "var(--color-lime)", fontSize: "0.78rem" }}>
          Open verification bundle JSON
        </a>
        <a href="/verify/agent-card.json" target="_blank" rel="noreferrer" style={{ color: "var(--color-lime)", fontSize: "0.78rem" }}>
          Open agent card JSON
        </a>
        <a href={`${API_BASE_URL.replace(/\/api$/, "")}/mcp`} target="_blank" rel="noreferrer" style={{ color: "var(--color-lime)", fontSize: "0.78rem" }}>
          Open MCP endpoint
        </a>
        <a href={`${API_BASE_URL.replace(/\/api$/, "")}/sse`} target="_blank" rel="noreferrer" style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>
          Open legacy SSE endpoint
        </a>
        <button
          onClick={() => {
            void copyText("mcp", mcpConfig);
          }}
          style={{ border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-primary)", borderRadius: "8px", padding: "0.35rem 0.6rem", fontSize: "0.74rem", cursor: "pointer" }}
        >
          {copiedKey === "mcp" ? "Copied MCP config" : "Copy MCP config"}
        </button>
        <button
          onClick={() => {
            void copyText("mcp-sse", legacySseConfig);
          }}
          style={{ border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-primary)", borderRadius: "8px", padding: "0.35rem 0.6rem", fontSize: "0.74rem", cursor: "pointer" }}
        >
          {copiedKey === "mcp-sse" ? "Copied SSE config" : "Copy legacy SSE config"}
        </button>
        <button
          onClick={() => {
            void copyText("policy", policySummary);
          }}
          style={{ border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-primary)", borderRadius: "8px", padding: "0.35rem 0.6rem", fontSize: "0.74rem", cursor: "pointer" }}
        >
          {copiedKey === "policy" ? "Copied policy summary" : "Copy policy summary"}
        </button>
        <button
          onClick={() => {
            void copyText("bundle", JSON.stringify(bundle ?? {}, null, 2));
          }}
          style={{ border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-primary)", borderRadius: "8px", padding: "0.35rem 0.6rem", fontSize: "0.74rem", cursor: "pointer" }}
        >
          {copiedKey === "bundle" ? "Copied verification bundle" : "Copy verification bundle"}
        </button>
      </div>
    </section>
  );
};

export default VerifyPanel;
