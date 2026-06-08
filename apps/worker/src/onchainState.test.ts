import test from "node:test";
import assert from "node:assert/strict";
import { deriveAutomationReady, readVaultBalances, resetVaultBalanceCacheForTests } from "./onchainState";

const vaultAddress = "0x1111111111111111111111111111111111111111";

test.afterEach(() => {
  resetVaultBalanceCacheForTests();
});

test("readVaultBalances retries primary RPCs and succeeds through the fallback RPC", async () => {
  const env = {
    MANTLE_SEPOLIA_RPC_URL: "https://primary.example",
    MANTLE_SEPOLIA_RPC_FALLBACK_URL: "https://fallback.example",
  };

  let primaryAttempts = 0;
  let fallbackAttempts = 0;

  const balances = await readVaultBalances(vaultAddress, env, {
    retryDelayMs: 0,
    createClient: (rpcUrl) => ({
      async getBalance() {
        if (rpcUrl === "https://primary.example") {
          primaryAttempts += 1;
          throw new Error("primary rpc down");
        }
        fallbackAttempts += 1;
        return 11n * 10n ** 18n;
      },
      async readContract(args: any) {
        if (args.functionName === "balanceOf") {
          return 0n;
        }
        if (args.functionName === "decimals") {
          return 18;
        }
        return "USDY";
      },
    }),
  });

  assert.equal(primaryAttempts, 2);
  assert.equal(fallbackAttempts, 1);
  assert.equal(balances.nativeBalance.balanceFormatted, "11");
  assert.equal(balances.nativeBalance.readStatus, "live");
  assert.match(balances.sources[0]?.detail ?? "", /fallback chain RPC/i);
});

test("readVaultBalances returns the last successful cached native balance when RPC reads fail", async () => {
  const env = {
    MANTLE_SEPOLIA_RPC_URL: "https://primary.example",
  };

  const first = await readVaultBalances(vaultAddress, env, {
    nowMs: Date.parse("2026-06-05T12:00:00.000Z"),
    retryDelayMs: 0,
    createClient: () => ({
      async getBalance() {
        return 11n * 10n ** 18n;
      },
      async readContract(args: any) {
        if (args.functionName === "balanceOf") {
          return 0n;
        }
        if (args.functionName === "decimals") {
          return 18;
        }
        return "USDY";
      },
    }),
  });

  assert.equal(first.nativeBalance.readStatus, "live");

  const second = await readVaultBalances(vaultAddress, env, {
    nowMs: Date.parse("2026-06-05T12:00:05.000Z"),
    retryDelayMs: 0,
    createClient: () => ({
      async getBalance() {
        throw new Error("rpc unavailable");
      },
      async readContract() {
        throw new Error("rpc unavailable");
      },
    }),
  });

  assert.equal(second.nativeBalance.balanceFormatted, "11");
  assert.equal(second.nativeBalance.readStatus, "cached");
  assert.equal(second.nativeBalance.asOf, "2026-06-05T12:00:00.000Z");
  assert.equal(second.sources[0]?.status, "configured");
  assert.equal(second.sources.some((source) => source.id === "vault_balance_cache"), true);
});

test("deriveAutomationReady requires active execution scope, synced policy, and installed runtime", () => {
  const baseState = {
    vault: { vault_id: "vault_1" },
    config: { user_id: "user_1" },
    activeGrant: { status: "active", allowed_domains: ["state", "execution"] },
    activeMcpSession: { status: "active", allowed_domains: ["state", "execution"] },
  } satisfies Record<string, unknown>;
  const runtimeState = {
    safeDeployed: true,
    vaultModuleEnabled: true,
    safe7579Enabled: true,
    fallbackHandlerReady: true,
    moduleGuardReady: true,
    trustedModuleReady: true,
    delegateReady: true,
    delegateGasReady: true,
  };
  const onchainPolicy = {
    validAfter: Math.floor(Date.parse("2026-06-05T18:00:00.000Z") / 1000),
    validUntil: Math.floor(Date.parse("2026-06-06T06:00:00.000Z") / 1000),
  };
  const nowMs = Date.parse("2026-06-05T19:00:00.000Z");

  assert.equal(
    deriveAutomationReady(baseState, runtimeState, onchainPolicy, "in_sync", nowMs),
    true,
  );
  assert.equal(
    deriveAutomationReady(baseState, { ...runtimeState, vaultModuleEnabled: false }, onchainPolicy, "in_sync", nowMs),
    false,
  );
  assert.equal(
    deriveAutomationReady(baseState, { ...runtimeState, trustedModuleReady: false }, onchainPolicy, "in_sync", nowMs),
    true,
  );
  assert.equal(
    deriveAutomationReady(baseState, { ...runtimeState, delegateGasReady: false }, onchainPolicy, "in_sync", nowMs),
    true,
  );
  assert.equal(
    deriveAutomationReady(baseState, runtimeState, onchainPolicy, "pending_publish", nowMs),
    false,
  );
  assert.equal(
    deriveAutomationReady(
      {
        ...baseState,
        activeGrant: { status: "active", allowed_domains: ["state"] },
      },
      runtimeState,
      onchainPolicy,
      "in_sync",
      nowMs,
    ),
    false,
  );
});

test("readOnchain-style storage slot decoding keeps Safe fallback and module guard addresses", async () => {
  const fallbackRaw = "0x0000000000000000000000007ec994fd2f774fb8aae472c349ed3e64e0a15fea";
  const guardRaw = "0x0000000000000000000000008b2ce65c9b18bf50cf26fa8ede70b2477dfdca9b";

  const fallbackAddress = `0x${fallbackRaw.slice(-40)}`.toLowerCase();
  const guardAddress = `0x${guardRaw.slice(-40)}`.toLowerCase();

  assert.equal(fallbackAddress, "0x7ec994fd2f774fb8aae472c349ed3e64e0a15fea");
  assert.equal(guardAddress, "0x8b2ce65c9b18bf50cf26fa8ede70b2477dfdca9b");
});
