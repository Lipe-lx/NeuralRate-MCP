import assert from "node:assert/strict";
import test from "node:test";
import { hasDetectedVaultDeposit, hasRuntimeNativeDeposit, mergeLiveFundingTelemetry, shouldAutoRefreshState, type AutomationState } from "./userState";

const baseState = {
  ownerEoa: "0xowner",
  userId: "user_1",
  profile: null,
  config: null,
  vault: {
    vault_id: "vault_1",
    user_id: "user_1",
    owner_eoa: "0xowner",
    vault_address: "0x1111111111111111111111111111111111111111",
    vault_kind: "dedicated-safe-vault",
    vault_provider: "safe",
    agent_scope_wallet: null,
    chain_id: 5003,
    status: "active",
    funding_status: "awaiting_deposit",
    automation_status: "inactive",
    balance_usd: "0",
    deposit_address: null,
    last_funding_intent: { amountUsd: 1000 },
    ownership_acknowledged_at: null,
  },
  permissions: [],
  activePermission: null,
  sessions: [],
  activeSession: null,
  grants: [],
  activeGrant: null,
  mcpSessions: [],
  activeMcpSession: null,
  automationJobs: [],
  benchmarkJobs: [],
  automationReady: false,
} satisfies AutomationState;

test("hasRuntimeNativeDeposit accepts explicit flag, formatted balance, or wei balance", () => {
  assert.equal(hasRuntimeNativeDeposit({ ...baseState, runtimeState: { hasNativeBalance: true } }), true);
  assert.equal(hasRuntimeNativeDeposit({ ...baseState, runtimeState: { nativeBalanceFormatted: "0.00001" } }), true);
  assert.equal(hasRuntimeNativeDeposit({ ...baseState, runtimeState: { nativeBalanceWei: "1" } }), true);
  assert.equal(hasRuntimeNativeDeposit({ ...baseState, runtimeState: { nativeBalanceWei: "0" } }), false);
});

test("hasDetectedVaultDeposit accepts backend-reconciled token deposits", () => {
  assert.equal(hasDetectedVaultDeposit({
    ...baseState,
    vault: {
      ...baseState.vault,
      funding_status: "deposit_detected",
    },
    runtimeState: { nativeBalanceWei: "0" },
  }), true);
});

test("mergeLiveFundingTelemetry preserves same-vault detected deposit across refresh", () => {
  const current = {
    ...baseState,
    runtimeState: {
      hasNativeBalance: true,
      nativeBalanceWei: "420000000000000000",
      nativeBalanceFormatted: "0.42",
      nativeAssetSymbol: "MNT",
      lastCheckedAt: "2026-06-08T16:00:00.000Z",
    },
  } satisfies AutomationState;
  const incoming = {
    ...baseState,
    vault: {
      ...baseState.vault,
      funding_status: "awaiting_deposit",
    },
    runtimeState: {
      safeDeployed: true,
      vaultModuleEnabled: true,
    },
  } satisfies AutomationState;

  const merged = mergeLiveFundingTelemetry(incoming, current);

  assert.equal(merged.vault?.funding_status, "deposit_detected");
  assert.equal(merged.runtimeState?.hasNativeBalance, true);
  assert.equal(merged.runtimeState?.nativeBalanceWei, "420000000000000000");
  assert.equal(merged.runtimeState?.nativeBalanceFormatted, "0.42");
});

test("mergeLiveFundingTelemetry does not carry funding across different vaults", () => {
  const current = {
    ...baseState,
    runtimeState: {
      hasNativeBalance: true,
      nativeBalanceWei: "1",
    },
  } satisfies AutomationState;
  const incoming = {
    ...baseState,
    vault: {
      ...baseState.vault,
      vault_address: "0x2222222222222222222222222222222222222222",
      funding_status: "awaiting_deposit",
    },
  } satisfies AutomationState;

  const merged = mergeLiveFundingTelemetry(incoming, current);

  assert.equal(merged.vault?.funding_status, "awaiting_deposit");
  assert.equal(merged.runtimeState?.hasNativeBalance, undefined);
});

test("shouldAutoRefreshState returns true if hasSession is true, regardless of cachedState", () => {
  assert.equal(shouldAutoRefreshState(null, true), true);
  assert.equal(shouldAutoRefreshState(baseState, true), true);
});

test("shouldAutoRefreshState returns false if hasSession is false, regardless of cachedState", () => {
  assert.equal(shouldAutoRefreshState(null, false), false);
  assert.equal(shouldAutoRefreshState(baseState, false), false);
});
