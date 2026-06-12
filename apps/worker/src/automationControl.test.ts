import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPolicyPublishNextAction,
  createAutomationGrantChallenge,
  isVaultRuntimeInstallReady,
  preparePolicyPublish,
  queueBenchmarkThroughExecutor,
  prepareVaultRuntimeEnable,
  rotateActiveMcpSessionToken,
  submitPolicyPublish,
  updateAgentPolicyFromScopedAccess,
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
        authorization_ttl_hours: 72,
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
  assert.equal(result.expectedPolicy.validUntil - result.expectedPolicy.validAfter, 72 * 60 * 60);
  assert.equal(result.txRequest.to, "0x4444444444444444444444444444444444444444");
});

test("automation grant challenge uses the configured authorization duration", async () => {
  const issuedAt = "2026-06-12T12:00:00.000Z";
  const store = {
    getAutomationState: async () => ({
      ownerEoa: "0x1111111111111111111111111111111111111111",
      userId: "user_1",
      vault: {
        vault_id: "vault_1",
        vault_address: "0x2222222222222222222222222222222222222222",
      },
      config: {
        policy_version: "vault-v1",
        authorization_ttl_hours: 72,
      },
    }),
  } as any;

  const challenge = await createAutomationGrantChallenge(store, {
    ownerEoa: "0x1111111111111111111111111111111111111111",
    agentSubject: "erc8004:49",
    issuedAt,
  });

  assert.equal(challenge.issuedAt, issuedAt);
  assert.equal(challenge.expiresAt, "2026-06-15T12:00:00.000Z");
});

test("scoped MCP policy updates accept a composite authorization duration", async () => {
  let saved: Record<string, unknown> | undefined;
  const store = {
    upsertAgentConfig: async (input: Record<string, unknown>) => {
      saved = input;
      return input;
    },
  } as any;

  await updateAgentPolicyFromScopedAccess(
    store,
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
    },
    { authorizationDuration: { days: 1, hours: 12 } }
  );

  assert.equal(saved?.authorizationTtlHours, 36);
});

test("MCP token rotation uses its own duration and can recover an expired session", async () => {
  const grantExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const expiredSession = {
    session_id: "session_old",
    grant_id: "grant_1",
    owner_eoa: "0x1111111111111111111111111111111111111111",
    user_id: "user_1",
    vault_id: "vault_1",
    vault_address: "0x2222222222222222222222222222222222222222",
    agent_subject: "agent",
    policy_version: "vault-v1",
    allowed_domains: ["state", "execution"],
    issued_via: "web",
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  };
  let savedSession: Record<string, unknown> | undefined;
  const store = {
    getActiveAutomationGrant: async () => ({
      grant_id: "grant_1",
      owner_eoa: expiredSession.owner_eoa,
      user_id: expiredSession.user_id,
      vault_id: expiredSession.vault_id,
      vault_address: expiredSession.vault_address,
      agent_subject: expiredSession.agent_subject,
      policy_version: expiredSession.policy_version,
      allowed_domains: expiredSession.allowed_domains,
      nonce: "nonce",
      signature: "0xsig",
      grant_message: "message",
      issued_via: "web",
      issued_at: new Date(Date.now() - 60_000).toISOString(),
      expires_at: grantExpiresAt,
      session_id: expiredSession.session_id,
    }),
    getActiveMcpMutationSession: async () => null,
    getMcpMutationSession: async () => expiredSession,
    revokeMcpMutationSession: async () => undefined,
    upsertMcpMutationSession: async (input: Record<string, unknown>) => {
      savedSession = input;
      return input;
    },
    upsertAutomationGrant: async (input: Record<string, unknown>) => input,
  } as any;

  const result = await rotateActiveMcpSessionToken(store, expiredSession.owner_eoa, {
    days: 1,
    hours: 12,
  });

  const durationHours =
    (Date.parse(String(savedSession?.expiresAt)) - Date.parse(String(savedSession?.issuedAt))) /
    (60 * 60 * 1000);
  assert.ok(Math.abs(durationHours - 36) < 0.001);
  assert.equal(result.grantExpiresAt, savedSession?.expiresAt);
});

test("MCP token rotation cannot outlive the active authorization grant", async () => {
  const grantExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  let savedSession: Record<string, unknown> | undefined;
  const session = {
    session_id: "session_old",
    grant_id: "grant_1",
    owner_eoa: "0x1111111111111111111111111111111111111111",
    user_id: "user_1",
    vault_id: "vault_1",
    vault_address: "0x2222222222222222222222222222222222222222",
    agent_subject: "agent",
    policy_version: "vault-v1",
    allowed_domains: ["execution"],
    issued_via: "web",
    expires_at: grantExpiresAt,
  };
  const grant = {
    ...session,
    nonce: "nonce",
    signature: "0xsig",
    grant_message: "message",
    issued_at: new Date().toISOString(),
    session_id: session.session_id,
  };
  const store = {
    getActiveAutomationGrant: async () => grant,
    getActiveMcpMutationSession: async () => session,
    revokeMcpMutationSession: async () => undefined,
    upsertMcpMutationSession: async (input: Record<string, unknown>) => {
      savedSession = input;
      return input;
    },
    upsertAutomationGrant: async (input: Record<string, unknown>) => input,
  } as any;

  await rotateActiveMcpSessionToken(store, session.owner_eoa, { months: 1 });

  assert.equal(savedSession?.expiresAt, grantExpiresAt);
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

test("benchmark queue rejects decisions that already have on-chain proof", async () => {
  await assert.rejects(
    () =>
      queueBenchmarkThroughExecutor(
        { NEURALRATE_BENCHMARK_CONTRACT: "0x3333333333333333333333333333333333333333" },
        {
          getBenchmarkDecision: async () => ({
            decision_id: "decision_onchain",
            benchmark_status: "local",
            tx_hash: "0xabc",
            onchain_decision_id: "4",
          }),
        } as any,
        {
          ownerEoa: "0x1111111111111111111111111111111111111111",
          userId: "user_1",
          vaultId: "vault_1",
          vaultAddress: "0x2222222222222222222222222222222222222222",
          agentSubject: "agent",
          policyVersion: "vault-v1",
          sessionId: "session_1",
          grantId: "grant_1",
          allowedDomains: ["benchmark"],
          grantExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          authMode: "session",
        },
        {
          decisionId: "decision_onchain",
        }
      ),
    /already has an on-chain benchmark receipt/
  );
});
