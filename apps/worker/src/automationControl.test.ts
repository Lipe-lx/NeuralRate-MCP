import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPolicyPublishNextAction,
  isVaultRuntimeInstallReady,
  preparePolicyPublish,
  prepareVaultRuntimeEnable,
  submitPolicyPublish,
} from "./automationControl";

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

test("policy update next action asks for owner-signed publish when draft is not active", () => {
  assert.deepEqual(buildPolicyPublishNextAction("drifted"), {
    type: "publish_policy",
    label: "publish_policy",
    required: true,
    ownerSignatureRequired: true,
    tools: ["prepare_policy_publish", "submit_policy_publish"],
    message: "Policy draft saved. Call prepare_policy_publish, have the owner sign the transaction, then call submit_policy_publish with the tx hash and expectedPolicy.",
  });
  assert.equal(buildPolicyPublishNextAction("pending_publish").type, "publish_policy");
  assert.equal(buildPolicyPublishNextAction("not_published").type, "publish_policy");
  assert.equal(buildPolicyPublishNextAction("in_sync").type, "none");
});

test("policy publish preparation includes changed per-action and daily limits", async () => {
  const access = {
    ownerEoa: "0x1111111111111111111111111111111111111111",
    userId: "user_1",
    vaultId: "vault_1",
    vaultAddress: "0x2222222222222222222222222222222222222222",
    agentSubject: "agent",
    policyVersion: "vault-v1",
    sessionId: "session_1",
    grantId: "grant_1",
    allowedDomains: ["config"],
    grantExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    authMode: "session" as const,
  };
  const store = {
    getAutomationState: async () => ({
      ownerEoa: access.ownerEoa,
      userId: access.userId,
      vault: {
        vault_id: access.vaultId,
        vault_address: access.vaultAddress,
      },
      config: {
        policy_version: "vault-v1",
        max_action_usd: 750,
        max_daily_usd: 2200,
        max_automation_usd: 9000,
        max_slippage_bps: 45,
        allowed_assets: ["USDC"],
        allowed_protocols: ["AAVE-V3"],
      },
    }),
  } as any;

  const result = await preparePolicyPublish(
    store,
    {
      NEURALRATE_BENCHMARK_CONTRACT: "0x3333333333333333333333333333333333333333",
      NEURALRATE_POLICY_REGISTRY_CONTRACT: "0x4444444444444444444444444444444444444444",
      NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS: "0x5555555555555555555555555555555555555555",
      MANTLE_SEPOLIA_RPC_URL: "http://127.0.0.1:9",
    },
    access
  );

  assert.equal(result.policySyncStatus, "pending_publish");
  assert.equal(result.expectedPolicy.maxPerUse, 750);
  assert.equal(result.expectedPolicy.maxDaily, 2200);
  assert.equal(result.expectedPolicy.maxTotal, 9000);
  assert.equal(result.txRequest.to, "0x4444444444444444444444444444444444444444");
});

test("policy publish submission requires the prepared expected policy", async () => {
  await assert.rejects(
    () =>
      submitPolicyPublish(
        { getAutomationState: async () => ({}) } as any,
        { NEURALRATE_BENCHMARK_CONTRACT: "0x3333333333333333333333333333333333333333" },
        {
          ownerEoa: "0x1111111111111111111111111111111111111111",
          userId: "user_1",
          vaultId: "vault_1",
          vaultAddress: "0x2222222222222222222222222222222222222222",
          agentSubject: "agent",
          policyVersion: "vault-v1",
          sessionId: "session_1",
          grantId: "grant_1",
          allowedDomains: ["config"],
          grantExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          authMode: "session",
        }
      ),
    /expectedPolicy is required/
  );
});
