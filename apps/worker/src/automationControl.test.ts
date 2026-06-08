import test from "node:test";
import assert from "node:assert/strict";
import { isVaultRuntimeInstallReady } from "./automationControl";

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
