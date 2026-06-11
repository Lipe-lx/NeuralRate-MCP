import test from "node:test";
import assert from "node:assert/strict";
import { isVaultRuntimeInstallReady, prepareVaultRuntimeEnable } from "./automationControl";

const requirements = {
  requiresVaultModule: true,
  requiresSafe7579: true,
  requiresExecutionGuard: true,
  requiresTrustedSafeModule: true,
};

test("runtime install readiness does not require delegate signer gas", () => {
  assert.equal(
    isVaultRuntimeInstallReady({
      safeDeployed: true,
      vaultModuleEnabled: true,
      safe7579Enabled: true,
      delegateReady: true,
      delegateGasReady: false,
      fallbackHandlerReady: true,
      moduleGuardReady: true,
      trustedModuleReady: true,
      trustedSafeModuleReady: true,
    }, requirements),
    true,
  );
});

test("runtime install readiness still requires guard to trust the vault module", () => {
  assert.equal(
    isVaultRuntimeInstallReady({
      safeDeployed: true,
      vaultModuleEnabled: true,
      safe7579Enabled: true,
      delegateReady: true,
      delegateGasReady: true,
      fallbackHandlerReady: true,
      moduleGuardReady: true,
      trustedModuleReady: false,
      trustedSafeModuleReady: true,
    }, requirements),
    false,
  );
});

test("runtime install readiness requires Safe7579 trust when paymaster AA is required", () => {
  assert.equal(
    isVaultRuntimeInstallReady({
      safeDeployed: true,
      vaultModuleEnabled: true,
      safe7579Enabled: true,
      delegateReady: true,
      fallbackHandlerReady: true,
      moduleGuardReady: true,
      trustedModuleReady: true,
      trustedSafeModuleReady: false,
    }, requirements),
    false,
  );
});

test("runtime enable preparation rejects non-canonical runtime configuration", async () => {
  const store = {
    getAutomationState: async () => ({
      ownerEoa: "0xowner",
      userId: "user_1",
      vault: {
        vault_id: "vault_1",
        vault_address: "0x1111111111111111111111111111111111111111",
      },
      runtimeState: {
        safeDeployed: true,
        vaultModuleEnabled: false,
      },
    }),
  } as any;

  await assert.rejects(
    () =>
      prepareVaultRuntimeEnable(
        store,
        {
          NEURALRATE_BENCHMARK_CONTRACT: "0x2222222222222222222222222222222222222222",
          NEURALRATE_VAULT_MODULE_ADDRESS: "0x3333333333333333333333333333333333333333",
        },
        {
          ownerEoa: "0xowner",
          userId: "user_1",
          vaultId: "vault_1",
          vaultAddress: "0x1111111111111111111111111111111111111111",
          agentSubject: "owner-control",
          policyVersion: "vault-v1",
          sessionId: "owner-control",
          grantId: "owner-control",
          allowedDomains: ["state", "config", "benchmark", "execution"],
          grantExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          authMode: "signed",
        }
      ),
    /Safe7579\/ERC-4337 runtime is required/
  );
});
