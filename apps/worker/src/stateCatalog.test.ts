import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityFeedSnapshot,
  buildExecutionReadinessSnapshot,
  buildPolicySurfaceSnapshot,
  loadScopedStateCatalogSnapshot,
  resetStateCatalogCachesForTests,
  type VaultBalancesSnapshot,
} from "./stateCatalog";

const iso = (ms: number) => new Date(ms).toISOString();

test.afterEach(() => {
  resetStateCatalogCachesForTests();
});

test("policy surface calculates remaining daily and total budget from executed jobs", () => {
  const now = Date.parse("2026-06-05T12:00:00.000Z");
  const state = {
    policySyncStatus: "in_sync",
    config: {
      require_manual_above_usd: 800,
      policy_version: "vault-v2",
    },
    onchainPolicy: {
      policyVersion: "vault-v3",
      maxPerUse: "500",
      maxDaily: "1000",
      maxTotal: "5000",
      maxSlippageBps: 50,
      validAfter: Math.floor((now - 60_000) / 1000),
      validUntil: Math.floor((now + 60_000) / 1000),
      allowedAssets: ["USDY", "MNT"],
      allowedProtocols: ["neuralrate-usdy-adapter"],
      allowedTargets: ["0xabc"],
      allowedSelectors: ["0x12345678"],
    },
    activeGrant: {
      allowed_domains: ["state", "execution"],
    },
    activeMcpSession: {
      allowed_domains: ["state", "execution"],
    },
    automationJobs: [
      {
        status: "confirmed",
        confirmed_at: iso(now - 30 * 60 * 1000),
        payload: { intent: { amountUsd: 200 } },
      },
      {
        status: "confirmed",
        confirmed_at: iso(now - 48 * 60 * 60 * 1000),
        payload: { intent: { amountUsd: 300 } },
      },
      {
        status: "pending",
        created_at: iso(now - 5 * 60 * 1000),
        payload: { intent: { amountUsd: 150 } },
      },
      {
        status: "blocked",
        created_at: iso(now - 2 * 60 * 1000),
        failure_reason: "policy denied",
      },
    ],
  } satisfies Record<string, unknown>;

  const surface = buildPolicySurfaceSnapshot(state, now);

  assert.equal(surface.source, "onchain");
  assert.equal(surface.remainingBudget.dailyUsd, 800);
  assert.equal(surface.remainingBudget.totalUsd, 4500);
  assert.equal(surface.usage.executed24hUsd, 200);
  assert.equal(surface.usage.executedTotalUsd, 500);
  assert.equal(surface.usage.pendingUsd, 150);
  assert.equal(surface.usage.failedCount, 1);
  assert.deepEqual(surface.domain.grantAllowedDomains, ["state", "execution"]);
});

test("execution readiness blocks when execution policy, grant domain, session domain, runtime, and gas are missing", () => {
  const state = {
    policySyncStatus: "pending_publish",
    runtimeState: {
      safeDeployed: true,
      vaultModuleEnabled: false,
      safe7579Enabled: false,
      fallbackHandlerReady: false,
      moduleGuardReady: false,
      installedDelegate: "0xinstalled",
      delegateReady: false,
      moduleGuard: "0xguard",
    },
    aa: {
      agentSessionSignerAddress: "0xexpecteddelegate",
      executionGuardContract: "0xexpectedguard",
    },
    activeGrant: {
      grant_id: "grant_1",
      status: "active",
      expires_at: "2026-06-06T00:00:00.000Z",
      allowed_domains: ["state"],
    },
    activeMcpSession: {
      session_id: "mcp_1",
      status: "active",
      expires_at: "2026-06-06T00:00:00.000Z",
      allowed_domains: ["state"],
    },
    automationJobs: [],
  } satisfies Record<string, unknown>;
  const balances: VaultBalancesSnapshot = {
    vaultAddress: "0xvault",
    chainId: 5003,
    asOf: "2026-06-05T12:00:00.000Z",
    nativeBalance: {
      asset: "MNT",
      kind: "native",
      address: null,
      decimals: 18,
      balanceRaw: "0",
      balanceFormatted: "0",
      hasBalance: false,
      valuationUsd: null,
      valuationSource: null,
      readStatus: "live",
      asOf: "2026-06-05T12:00:00.000Z",
    },
    tokenBalances: [],
    spendableUsd: null,
    sources: [],
  };

  const readiness = buildExecutionReadinessSnapshot(state, balances, buildPolicySurfaceSnapshot(state));

  assert.equal(readiness.status, "blocked");
  assert.match(readiness.blockedReasons.join(" | "), /No active on-chain execution policy/);
  assert.match(readiness.blockedReasons.join(" | "), /does not include the execution domain/);
  assert.match(readiness.blockedReasons.join(" | "), /no native gas balance/i);
  assert.equal(readiness.grant.executionAllowed, false);
  assert.equal(readiness.session.executionAllowed, false);
});

test("activity feed sorts newest events first and preserves benchmark linkage", () => {
  const now = Date.parse("2026-06-05T12:00:00.000Z");
  const feed = buildActivityFeedSnapshot({
    automationJobs: [
      {
        job_id: "job_old",
        job_type: "execute_strategy",
        status: "confirmed",
        confirmed_at: iso(now - 60 * 60 * 1000),
        execution_domain: "execution",
        payload: { intent: { amountUsd: 400 } },
      },
    ],
    benchmarkJobs: [
      {
        benchmark_job_id: "bench_new",
        decision_id: "decision_123",
        onchain_decision_id: "42",
        status: "submitted",
        tx_hash: "0xtx",
        confirmed_at: iso(now - 5 * 60 * 1000),
      },
    ],
  }, now);

  assert.equal(feed.items[0]?.id, "bench_new");
  assert.equal(feed.items[0]?.benchmarkDecisionId, "42");
  assert.equal(feed.summary.executed, 2);
  assert.equal(feed.summary.benchmarkLinked, 1);
});

test("scoped state snapshots are reused briefly to avoid cross-tool drift", async () => {
  let reads = 0;
  const automation = {
    async getAutomationState(ownerEoa: string) {
      reads += 1;
      return {
        ownerEoa,
        vault: null,
        automationJobs: [],
        benchmarkJobs: [],
      };
    },
  } as any;

  const env = {} as any;
  const owner = "0xabc";

  const first = await loadScopedStateCatalogSnapshot(automation, env, owner);
  const second = await loadScopedStateCatalogSnapshot(automation, env, owner);

  assert.equal(reads, 1);
  assert.strictEqual(second, first);
});
