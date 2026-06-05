import test from "node:test";
import assert from "node:assert/strict";
import { planGovernedExecutionActionFromSnapshot } from "./executionActions";
import type { ScopedAutomationAccess } from "./automationControl";
import type { StateCatalogSnapshot } from "./stateCatalog";

const makeAccess = (): ScopedAutomationAccess => ({
  ownerEoa: "0xc57130f28f3d670ca75ad9a78784966b767e55e3",
  userId: "user_1",
  vaultId: "vault_1",
  vaultAddress: "0x1111111111111111111111111111111111111111",
  agentSubject: "erc8004:1",
  policyVersion: "vault-v1",
  sessionId: "session_1",
  grantId: "grant_1",
  allowedDomains: ["state", "execution"],
  grantExpiresAt: "2026-06-06T00:00:00.000Z",
  authMode: "session",
});

const makeSnapshot = (): StateCatalogSnapshot => ({
  state: {},
  balances: {
    vaultAddress: "0x1111111111111111111111111111111111111111",
    chainId: 5003,
    asOf: "2026-06-05T12:00:00.000Z",
    nativeBalance: {
      asset: "MNT",
      kind: "native",
      address: null,
      decimals: 18,
      balanceRaw: "1000000000000000000",
      balanceFormatted: "1",
      hasBalance: true,
      valuationUsd: null,
      valuationSource: null,
      readStatus: "live",
      asOf: "2026-06-05T12:00:00.000Z",
    },
    tokenBalances: [],
    spendableUsd: 1000,
    sources: [],
  },
  positions: [{
    positionId: "vault:usdy:0",
    protocol: "vault-wallet",
    asset: "USDY",
    positionType: "wallet_balance",
    amount: {
      raw: "100",
      formatted: "100",
      decimals: 18,
    },
    usdValue: null,
    rewards: [],
    health: {
      status: "unlevered",
      detail: "test",
    },
    exitConstraints: [],
  }],
  policySurface: {
    source: "onchain",
    syncStatus: "in_sync",
    policyVersion: "vault-v1",
    requireSnapshot: true,
    limits: {
      perUseUsd: 500,
      dailyUsd: 1000,
      totalUsd: 5000,
      manualApprovalUsd: 800,
      maxSlippageBps: 50,
    },
    allowlists: {
      assets: ["MNT", "USDY"],
      protocols: ["NEURALRATE-VAULT-MODULE"],
      targets: [],
      selectors: [],
    },
    validity: {
      validAfter: "2026-06-05T11:00:00.000Z",
      validUntil: "2026-06-05T15:00:00.000Z",
      isActiveNow: true,
    },
    domain: {
      policyDomain: "execution",
      grantAllowedDomains: ["state", "execution"],
      sessionAllowedDomains: ["state", "execution"],
    },
    usage: {
      executed24hUsd: 100,
      executedTotalUsd: 300,
      pendingUsd: 0,
      executedCount: 1,
      failedCount: 0,
    },
    remainingBudget: {
      perUseUsd: 500,
      dailyUsd: 900,
      totalUsd: 4700,
    },
  },
  readiness: {
    status: "ready",
    balance: {
      vaultAddress: "0x1111111111111111111111111111111111111111",
      nativeGasAsset: "MNT",
      nativeGasBalanceFormatted: "1",
      nativeGasReady: true,
      tokenBalances: [],
      spendableUsd: 1000,
    },
    policy: {
      published: true,
      syncStatus: "in_sync",
      policyVersion: "vault-v1",
      limits: {
        perUseUsd: 500,
        dailyUsd: 1000,
        totalUsd: 5000,
        manualApprovalUsd: 800,
        maxSlippageBps: 50,
      },
    },
    delegate: {
      expected: "0xdelegate",
      installed: "0xdelegate",
      ready: true,
    },
    guard: {
      expected: "0xguard",
      installed: "0xguard",
      ready: true,
    },
    module: {
      safeDeployed: true,
      vaultModuleEnabled: true,
      safe7579Enabled: true,
      fallbackHandlerReady: true,
    },
    grant: {
      id: "grant_1",
      status: "active",
      expiresAt: "2026-06-06T00:00:00.000Z",
      executionAllowed: true,
    },
    session: {
      id: "session_1",
      status: "active",
      expiresAt: "2026-06-06T00:00:00.000Z",
      executionAllowed: true,
    },
    blockedReasons: [],
    warnings: [],
  },
  activityFeed: {
    asOf: "2026-06-05T12:00:00.000Z",
    summary: {
      total: 0,
      executed: 0,
      blocked: 0,
      pending: 0,
      benchmarkLinked: 0,
    },
    items: [],
  },
});

test("transfer_asset maps MNT transfers to the pinned MNT strategy with recipient preflight", () => {
  const plan = planGovernedExecutionActionFromSnapshot(
    makeSnapshot(),
    makeAccess(),
    "transfer_asset",
    {
      asset: "MNT",
      amountUsd: 10,
      amountToken: 2,
      recipientAddress: "0x2222222222222222222222222222222222222222",
      snapshotHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }
  );

  assert.equal(plan.status, "ready");
  assert.equal(plan.strategyKey, "mnt-native-transfer");
  assert.equal(plan.intent?.recipientAddress, "0x2222222222222222222222222222222222222222");
});

test("open_position maps USDY allocation to the pinned strategy", () => {
  const plan = planGovernedExecutionActionFromSnapshot(
    makeSnapshot(),
    makeAccess(),
    "open_position",
    {
      asset: "USDY",
      amountUsd: 100,
      slippageBps: 25,
      snapshotHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    }
  );

  assert.equal(plan.status, "ready");
  assert.equal(plan.strategyKey, "usdy-stable-allocation");
  assert.equal(plan.intent?.targetAsset, "USDY");
});

test("close_position closes a wallet-held USDY position through the governed transfer path", () => {
  const plan = planGovernedExecutionActionFromSnapshot(
    makeSnapshot(),
    makeAccess(),
    "close_position",
    {
      positionId: "vault:usdy:0",
      recipientAddress: "0x4444444444444444444444444444444444444444",
      snapshotHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    }
  );

  assert.equal(plan.status, "ready");
  assert.equal(plan.strategyKey, "usdy-vault-transfer");
  assert.equal(plan.intent?.recipientAddress, "0x4444444444444444444444444444444444444444");
});

test("approve_strategy_spender maps to the governed USDY approval path", () => {
  const plan = planGovernedExecutionActionFromSnapshot(
    makeSnapshot(),
    makeAccess(),
    "approve_strategy_spender",
    {
      asset: "USDY",
      amountUsd: 100,
      spenderAddress: "0x5555555555555555555555555555555555555555",
      snapshotHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    }
  );

  assert.equal(plan.status, "ready");
  assert.equal(plan.strategyKey, "usdy-approve-spender");
  assert.equal(plan.intent?.spenderAddress, "0x5555555555555555555555555555555555555555");
});

test("common preflight blocks execution when snapshotHash is required and missing", () => {
  const plan = planGovernedExecutionActionFromSnapshot(
    makeSnapshot(),
    makeAccess(),
    "sweep_idle_balance",
    {
      asset: "MNT",
      amountUsd: 50,
    }
  );

  assert.equal(plan.status, "blocked");
  assert.match(plan.blockedReasons.join(" | "), /requires snapshotHash/i);
});

test("claim_rewards becomes a noop when the resolved wallet-held position has no rewards", () => {
  const plan = planGovernedExecutionActionFromSnapshot(
    makeSnapshot(),
    makeAccess(),
    "claim_rewards",
    {
      positionId: "vault:usdy:0",
    }
  );

  assert.equal(plan.status, "noop");
  assert.equal(plan.supported, true);
});
