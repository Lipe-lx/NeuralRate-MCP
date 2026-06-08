import test from "node:test";
import assert from "node:assert/strict";
import { isVaultRuntimeInstallReady } from "./automationControl";

const requirements = {
  requiresVaultModule: true,
  requiresSafe7579: true,
  requiresExecutionGuard: true,
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
    }, requirements),
    false,
  );
});
