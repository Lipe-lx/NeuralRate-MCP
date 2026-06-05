import test from "node:test";
import assert from "node:assert/strict";
import { readVaultBalances, resetVaultBalanceCacheForTests } from "./onchainState";

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
