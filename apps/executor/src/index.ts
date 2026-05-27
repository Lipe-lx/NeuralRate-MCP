import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createPublicClient, defineChain, http } from "viem";
import { config } from "./config.js";
import { DataApiClient } from "./dataApi.js";
import {
  AddressOnlyManagedSigner,
  RemoteManagedSigner,
  TurnkeyManagedSigner,
  type ManagedSigner,
} from "./managedSigner.js";
import { buildBenchmarkPolicy, buildExecutionPolicy } from "./policy.js";
import { executeBenchmarkJob } from "./benchmarkExecutor.js";
import { getApprovedStrategySurface, resolveExecutionPlan } from "./executionPlanner.js";
import type { StrategyIntent } from "./executionRegistry.js";
import { ensureAnchoredSnapshot, getActivePolicy } from "./onchainPolicy.js";

const dataApi = new DataApiClient(config.dataApiBaseUrl.replace(/\/+$/, ""), config.internalApiToken);
const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [config.mantleSepoliaRpcUrl] },
  },
});
const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(config.mantleSepoliaRpcUrl),
});
const managedSigner: ManagedSigner = config.managedSignerUrl
  ? new RemoteManagedSigner(config.managedSignerUrl, config.managedSignerToken)
  : (
      config.turnkeyOrganizationId &&
      config.turnkeyApiPublicKey &&
      config.turnkeyApiPrivateKey &&
      config.turnkeyWalletAccountAddress
    )
      ? new TurnkeyManagedSigner({
          apiBaseUrl: config.turnkeyApiBaseUrl,
          organizationId: config.turnkeyOrganizationId,
          apiPublicKey: config.turnkeyApiPublicKey,
          apiPrivateKey: config.turnkeyApiPrivateKey,
          walletAccountAddress: config.turnkeyWalletAccountAddress,
          walletAccountId: config.turnkeyWalletAccountId,
        })
      : new AddressOnlyManagedSigner(config.agentSessionSignerAddress);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

const sendJson = (response: ServerResponse, status: number, payload: unknown) => {
  response.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
};

const readJson = async <T>(request: IncomingMessage) => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
};

const makeId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const waitForConfirmation = async (txHash: `0x${string}`) => {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }

  const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
  return new Date(Number(block.timestamp) * 1000).toISOString();
};

const getNumeric = (record: Record<string, unknown> | null | undefined, key: string, fallback: number) => {
  const raw = record?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

type AutomationStateResponse = {
  ownerEoa: string;
  userId?: string | null;
  config?: Record<string, unknown> | null;
  vault?: Record<string, unknown> | null;
  account?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  activeSession?: Record<string, unknown> | null;
};

type MutationAuthPayload = {
  ownerEoa: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
};

const isInternalExecutorRequest = (request: IncomingMessage) =>
  request.headers["x-neuralrate-internal-token"] === config.internalApiToken;

const assertInternalExecutorRequest = (request: IncomingMessage) => {
  if (!isInternalExecutorRequest(request)) {
    throw new Error("Executor only accepts internal worker requests.");
  }
};

const resolveScopedState = async (ownerEoa: string) => {
  const state = (await dataApi.getAutomationState(ownerEoa)) as AutomationStateResponse;
  const vaultAddress = String(state.vault?.vault_address ?? state.account?.user_smart_account ?? "");

  if (!state.vault?.vault_id) {
    throw new Error("User vault is not provisioned yet. Bootstrap the user first.");
  }

  return {
    state,
    ownerEoa: ownerEoa.toLowerCase(),
    userId: String(state.userId ?? state.profile?.user_id ?? ""),
    vaultId: String(state.vault.vault_id),
    vaultAddress: vaultAddress.toLowerCase(),
    policyVersion: String(state.config?.policy_version ?? config.sessionPolicyVersion),
    config: state.config ?? {},
  };
};

createServer(async (request, response) => {
  try {
    if (!request.url || !request.method) {
      sendJson(response, 400, { error: "Malformed request" });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders);
      response.end();
      return;
    }

    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

    if (url.pathname === "/health" && request.method === "GET") {
      sendJson(response, 200, {
        status: "ok",
        service: "neuralrate-executor",
        chainId: 5003,
        benchmarkContract: config.benchmarkContract,
        agentSmartWallet: config.agentSmartWallet,
        vaultProviderStrategy: config.vaultProviderStrategy,
        onboardingProvider: config.onboardingProvider,
        managedSignerProvider: config.managedSignerProvider,
        managedSigner: await managedSigner.getPublicAddress(),
        capabilities: managedSigner.getCapabilities(),
        approvedStrategies: getApprovedStrategySurface().strategyKeys,
      });
      return;
    }

    assertInternalExecutorRequest(request);

    if (url.pathname === "/v1/state" && request.method === "GET") {
      const ownerEoa = url.searchParams.get("ownerEoa");
      if (!ownerEoa) {
        sendJson(response, 400, { error: "ownerEoa is required" });
        return;
      }

      const state = await dataApi.getAutomationState(ownerEoa);
      sendJson(response, 200, state);
      return;
    }

    if (url.pathname === "/v1/users/bootstrap" && request.method === "POST") {
      const body = await readJson<{
        ownerEoa: string;
        externalWallet?: string;
        embeddedWallet?: string | null;
        authStrategy?: string | null;
        displayName?: string | null;
        vaultAddress?: string | null;
        vaultProvider?: string | null;
        vaultKind?: string | null;
        vaultStatus?: string | null;
        auth?: MutationAuthPayload;
      }>(request);
      const state = await dataApi.bootstrapUser({
        ownerEoa: body.ownerEoa,
        externalWallet: body.externalWallet ?? body.ownerEoa,
        embeddedWallet: body.embeddedWallet ?? null,
        authStrategy: body.authStrategy ?? "passkey-embedded",
        displayName: body.displayName ?? null,
        vaultAddress: body.vaultAddress ?? null,
        vaultProvider: body.vaultProvider ?? config.vaultProviderStrategy,
        vaultKind: body.vaultKind ?? "dedicated-agent-vault",
        vaultStatus: body.vaultStatus ?? (body.vaultAddress ? "predicted" : "provisioning"),
        chainId: 5003,
      });

      sendJson(response, 200, { success: true, state });
      return;
    }

    if (
      (url.pathname === "/v1/automation/prepare" || url.pathname === "/v1/sessions/prepare") &&
      request.method === "POST"
    ) {
      const body = await readJson<{
        ownerEoa: string;
        vaultAddress?: string | null;
        spendToken?: string | null;
        spendLimitPerUse?: string | null;
        spendLimitDaily?: string | null;
        spendLimitTotal?: string | null;
        usageLimit?: number | null;
        validAfter?: string | null;
        validUntil?: string | null;
        auth?: MutationAuthPayload;
      }>(request);
      const scoped = await resolveScopedState(body.ownerEoa);
      const policyId = makeId("policy");
      const benchmarkPolicyId = makeId("policy");
      const sessionId = makeId("session");
      const signerAddress = await managedSigner.getPublicAddress();

      const executionPolicy = buildExecutionPolicy(
        {
          ownerEoa: scoped.ownerEoa,
          userId: scoped.userId,
          vaultId: scoped.vaultId,
          vaultAddress: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
          spendToken: body.spendToken ?? "USDC",
          spendLimitPerUse: body.spendLimitPerUse ?? String(scoped.config.max_action_usd ?? 1000),
          spendLimitDaily: body.spendLimitDaily ?? String(scoped.config.max_daily_usd ?? 2500),
          spendLimitTotal: body.spendLimitTotal ?? String(scoped.config.max_automation_usd ?? 10000),
          usageLimit: body.usageLimit ?? 25,
          validAfter: body.validAfter,
          validUntil: body.validUntil,
          allowedAssets: (scoped.config.allowed_assets as string[] | undefined) ?? [],
          allowedProtocols: (scoped.config.allowed_protocols as string[] | undefined) ?? [],
        },
        scoped.policyVersion
      );

      const benchmarkPolicy = buildBenchmarkPolicy(
        {
          ownerEoa: scoped.ownerEoa,
          userId: scoped.userId,
          vaultId: scoped.vaultId,
          vaultAddress: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
          validAfter: body.validAfter,
          validUntil: body.validUntil,
        },
        config.benchmarkContract,
        scoped.policyVersion
      );

      await dataApi.upsertAccount({
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
        chainId: 5003,
        accountProvider: config.vaultProviderStrategy,
        accountKind: "dedicated-agent-vault",
        deploymentStatus: scoped.state.vault?.status ?? "predicted",
        userId: scoped.userId,
        vaultId: scoped.vaultId,
      });

      await dataApi.upsertPolicy({
        policyId,
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
        chainId: 5003,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        ...executionPolicy,
      });

      await dataApi.upsertPolicy({
        policyId: benchmarkPolicyId,
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
        chainId: 5003,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        ...benchmarkPolicy,
      });

      await dataApi.upsertSession({
        sessionId,
        policyId,
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
        agentSessionSigner: signerAddress,
        chainId: 5003,
        sessionStatus: "pending_user",
        validAfter: executionPolicy.validAfter,
        validUntil: executionPolicy.validUntil,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
      });

      sendJson(response, 200, {
        success: true,
        sessionId,
        policyId,
        benchmarkPolicyId,
        policyVersion: scoped.policyVersion,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        vaultAddress: (body.vaultAddress?.toLowerCase() || scoped.vaultAddress),
        agentSessionSigner: signerAddress,
        agentSmartWallet: config.agentSmartWallet.toLowerCase(),
        benchmarkContract: config.benchmarkContract.toLowerCase(),
        chainId: 5003,
        executionPolicy,
        benchmarkPolicy,
        approvedStrategies: getApprovedStrategySurface().strategyKeys,
        capabilities: managedSigner.getCapabilities(),
      });
      return;
    }

    if (
      (url.pathname === "/v1/automation/activate" || url.pathname === "/v1/sessions/activate") &&
      request.method === "POST"
    ) {
      const body = await readJson<{
        sessionId: string;
        policyId: string;
        ownerEoa: string;
        vaultAddress: string;
        grantTxHash?: string | null;
        permissionId?: string | null;
        sessionDetails: unknown;
        validAfter?: string | null;
        validUntil?: string | null;
        consentMessage?: string | null;
        consentSignature?: string | null;
        providerSessionRef?: string | null;
        providerPermissionRef?: string | null;
        consentDigest?: string | null;
        consentVerifiedAt?: string | null;
        auth?: MutationAuthPayload;
      }>(request);
      const scoped = await resolveScopedState(body.ownerEoa);
      const signerAddress = await managedSigner.getPublicAddress();
      const session = await dataApi.activateSession(body.sessionId, {
        policyId: body.policyId,
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress.toLowerCase(),
        agentSessionSigner: signerAddress,
        chainId: 5003,
        grantTxHash: body.grantTxHash,
        permissionId: body.permissionId,
        sessionDetails: body.sessionDetails,
        validAfter: body.validAfter,
        validUntil: body.validUntil,
        providerSessionRef: body.providerSessionRef,
        providerPermissionRef: body.providerPermissionRef,
        consentMessage: body.consentMessage,
        consentSignature: body.consentSignature,
        consentDigest: body.consentDigest,
        consentVerifiedAt: body.consentVerifiedAt,
        turnkeySignerRef: managedSigner.getCapabilities().mode === "turnkey"
          ? signerAddress
          : null,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
      });

      sendJson(response, 200, { success: true, session });
      return;
    }

    if (
      (url.pathname === "/v1/automation/revoke" || url.pathname === "/v1/sessions/revoke") &&
      request.method === "POST"
    ) {
      const body = await readJson<{
        sessionId: string;
        policyId: string;
        ownerEoa: string;
        vaultAddress: string;
        grantTxHash?: string | null;
        revokeTxHash?: string | null;
        permissionId?: string | null;
        sessionDetails?: unknown;
        providerSessionRef?: string | null;
        providerPermissionRef?: string | null;
        auth?: MutationAuthPayload;
      }>(request);
      const scoped = await resolveScopedState(body.ownerEoa);
      const signerAddress = await managedSigner.getPublicAddress();
      const session = await dataApi.revokeSession(body.sessionId, {
        policyId: body.policyId,
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress.toLowerCase(),
        agentSessionSigner: signerAddress,
        chainId: 5003,
        sessionStatus: "revoked",
        grantTxHash: body.grantTxHash,
        revokeTxHash: body.revokeTxHash,
        permissionId: body.permissionId,
        sessionDetails: body.sessionDetails,
        revokedAt: new Date().toISOString(),
        providerSessionRef: body.providerSessionRef,
        providerPermissionRef: body.providerPermissionRef,
        turnkeySignerRef: managedSigner.getCapabilities().mode === "turnkey"
          ? signerAddress
          : null,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
      });

      sendJson(response, 200, { success: true, session });
      return;
    }

    if (
      (url.pathname === "/v1/benchmark-jobs" || url.pathname === "/v1/automation/benchmark-jobs") &&
      request.method === "POST"
    ) {
      const body = await readJson<{
        decisionId: string;
        ownerEoa: string;
        sessionId?: string | null;
        dataSnapshotHash?: string | null;
        payload?: Record<string, unknown>;
        auth?: MutationAuthPayload;
      }>(request);
      const scoped = await resolveScopedState(body.ownerEoa);
      const capabilities = managedSigner.getCapabilities();
      const benchmarkJobId = makeId("benchmark");
      const status = capabilities.canExecute ? "queued" : "blocked";
      const failureReason = capabilities.canExecute
        ? null
        : "Managed signer backend is not configured yet. Vault-scoped automation is persisted but execution is paused.";

      const benchmarkJob = await dataApi.upsertBenchmarkJob({
        benchmarkJobId,
        decisionId: body.decisionId,
        ownerEoa: scoped.ownerEoa,
        agentSmartWallet: config.agentSmartWallet,
        sessionId: body.sessionId ?? null,
        status,
        dataSnapshotHash: body.dataSnapshotHash,
        payload: {
          vaultId: scoped.vaultId,
          policyVersion: scoped.policyVersion,
          ...(body.payload ?? {}),
        },
        failureReason,
        providerJobRef: `${config.managedSignerProvider}:${benchmarkJobId}`,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
      });

      await dataApi.updateDecisionBenchmark(body.decisionId, {
        benchmarkStatus: capabilities.canExecute ? "pending" : "local",
        requestedBy: scoped.ownerEoa,
        agentAddress: config.agentSmartWallet,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
        dataSnapshotHash: body.dataSnapshotHash ?? null,
      });

      if (capabilities.canExecute) {
        try {
          const execution = await executeBenchmarkJob(managedSigner, {
            ownerEoa: scoped.ownerEoa,
            vaultAddress: scoped.vaultAddress,
            decisionId: body.decisionId,
            policyVersion: String(body.payload?.policyVersion ?? scoped.policyVersion),
            strategyKey: String(body.payload?.strategyKey ?? "benchmark-only"),
            snapshotHash: typeof body.payload?.snapshotHash === "string" ? body.payload.snapshotHash : body.dataSnapshotHash ?? null,
            snapshotCid: typeof body.payload?.snapshotCid === "string" ? body.payload.snapshotCid : body.dataSnapshotHash ?? null,
            predictedApyBps: Number(body.payload?.predictedApyBps ?? 0),
            settlementHorizonHours: Number(body.payload?.settlementHorizonHours ?? 24),
          });

          await dataApi.updateBenchmarkJob(benchmarkJobId, {
            decisionId: body.decisionId,
            ownerEoa: scoped.ownerEoa,
            sessionId: body.sessionId ?? null,
            agentSmartWallet: config.agentSmartWallet,
            status: "confirmed",
            txHash: execution.txHash,
            onchainDecisionId: execution.onchainDecisionId,
            confirmedAt: execution.confirmedAt,
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });

          await dataApi.updateDecisionBenchmark(body.decisionId, {
            benchmarkStatus: "onchain",
            txHash: execution.txHash,
            onchainDecisionId: execution.onchainDecisionId,
            requestedBy: scoped.ownerEoa,
            dataSnapshotHash: body.dataSnapshotHash ?? "",
            agentAddress: config.agentSmartWallet,
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });
        } catch (error) {
          console.error("Benchmark execution failed:", error);
          await dataApi.updateBenchmarkJob(benchmarkJobId, {
            decisionId: body.decisionId,
            ownerEoa: scoped.ownerEoa,
            sessionId: body.sessionId ?? null,
            agentSmartWallet: config.agentSmartWallet,
            status: "failed",
            failureReason: error instanceof Error ? error.message : String(error),
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });
          await dataApi.updateDecisionBenchmark(body.decisionId, {
            benchmarkStatus: "local",
            requestedBy: scoped.ownerEoa,
            agentAddress: config.agentSmartWallet,
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });
        }
      }

      sendJson(response, 200, {
        success: true,
        benchmarkJob,
        executionCapable: capabilities.canExecute,
      });
      return;
    }

    if (
      (url.pathname === "/v1/jobs" || url.pathname === "/v1/automation/jobs") &&
      request.method === "POST"
    ) {
      const body = await readJson<{
        sessionId?: string | null;
        ownerEoa: string;
        vaultAddress?: string | null;
        executionDomain?: "benchmark" | "execution";
        jobType: string;
        strategyKey?: string | null;
        intent?: StrategyIntent | null;
        targetContract?: string | null;
        targetSelector?: string | null;
        payload?: Record<string, unknown>;
        auth?: MutationAuthPayload;
      }>(request);
      const scoped = await resolveScopedState(body.ownerEoa);
      const capabilities = managedSigner.getCapabilities();
      const jobId = makeId("job");
      const strategyKey = typeof body.strategyKey === "string" ? body.strategyKey : null;
      const normalizedIntent = body.intent && typeof body.intent === "object"
        ? {
            targetAsset: typeof body.intent.targetAsset === "string" ? body.intent.targetAsset : "",
            amountUsd:
              typeof body.intent.amountUsd === "number"
                ? body.intent.amountUsd
                : Number.parseFloat(String(body.intent.amountUsd ?? "")),
            slippageBps:
              typeof body.intent.slippageBps === "number"
                ? body.intent.slippageBps
                : body.intent.slippageBps == null
                  ? null
                  : Number.parseInt(String(body.intent.slippageBps), 10),
            notes: typeof body.intent.notes === "string" ? body.intent.notes : null,
            snapshotHash: typeof body.intent.snapshotHash === "string" ? body.intent.snapshotHash : null,
            snapshotCid: typeof body.intent.snapshotCid === "string" ? body.intent.snapshotCid : null,
            deadline: typeof body.intent.deadline === "string" ? body.intent.deadline : null,
          }
        : null;
      const isStrategyExecution = body.jobType === "strategy-execution" && strategyKey && normalizedIntent;

      let effectiveTargetContract = body.targetContract ?? null;
      let effectiveTargetSelector = body.targetSelector ?? null;
      let effectivePayload: Record<string, unknown> = {
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
        ...(body.payload ?? {}),
      };
      let effectiveCalldata = typeof body.payload?.calldata === "string" ? body.payload.calldata : null;
      let effectiveJobType = body.jobType;
      let status = "queued";
      let failureReason: string | null = null;
      let finalJob: unknown = null;

      if (isStrategyExecution) {
        const onchainPolicy = await getActivePolicy(body.vaultAddress?.toLowerCase() || scoped.vaultAddress);
        if (!onchainPolicy) {
          throw new Error("No active on-chain policy found for this vault.");
        }

        const anchoredSnapshot = await ensureAnchoredSnapshot({
          signer: managedSigner,
          vaultAddress: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
          snapshotHash: normalizedIntent.snapshotHash,
          snapshotCid: normalizedIntent.snapshotCid,
          descriptor: `strategy:${strategyKey}`,
        });

        normalizedIntent.snapshotHash = anchoredSnapshot.snapshotHash;
        const resolvedPlan = await resolveExecutionPlan(
          publicClient,
          strategyKey,
          normalizedIntent,
          {
            ownerEoa: scoped.ownerEoa,
            vaultAddress: (body.vaultAddress?.toLowerCase() || scoped.vaultAddress),
            chainId: 5003,
            policyVersion: onchainPolicy.policyVersion || scoped.policyVersion,
            maxActionUsd: Number(onchainPolicy.maxPerUse),
            maxAutomationUsd: Number(onchainPolicy.maxTotal),
            allowedAssets: Array.isArray(scoped.config.allowed_assets) ? scoped.config.allowed_assets as string[] : [],
            allowedProtocols: Array.isArray(scoped.config.allowed_protocols) ? scoped.config.allowed_protocols as string[] : [],
          },
        );

        effectiveTargetContract = resolvedPlan.targetContract;
        effectiveTargetSelector = resolvedPlan.targetSelector;
        effectiveCalldata = resolvedPlan.calldata;
        effectivePayload = {
          ...effectivePayload,
          strategyKey: resolvedPlan.strategyKey,
          strategyLabel: resolvedPlan.strategyLabel,
          protocolId: resolvedPlan.protocolId,
          actionId: resolvedPlan.actionId,
          targetAsset: resolvedPlan.targetAsset,
          resolvedContract: resolvedPlan.targetContract,
          resolvedSelector: resolvedPlan.targetSelector,
          resolvedArgs: resolvedPlan.resolvedArgs,
          validationStatus: resolvedPlan.validationStatus,
          validationReason: resolvedPlan.validationReason,
          bytecodeValidation: resolvedPlan.bytecodeValidation,
          policyChecks: resolvedPlan.policyChecks,
          executionSummary: resolvedPlan.executionSummary,
          riskFlags: resolvedPlan.riskFlags,
          intent: resolvedPlan.intent,
        };
        effectiveJobType = `strategy:${resolvedPlan.strategyKey}`;
        status = resolvedPlan.validationStatus === "ready" ? "queued" : "blocked";
        failureReason = resolvedPlan.validationReason;
      }

      if (status !== "blocked" && body.executionDomain === "execution" && !capabilities.canExecute) {
        status = "blocked";
        failureReason = "Managed signer backend is not configured yet. User vault jobs are stored but cannot be dispatched.";
      }

      finalJob = await dataApi.upsertAutomationJob({
        jobId,
        sessionId: body.sessionId,
        ownerEoa: scoped.ownerEoa,
        userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
        executionDomain: body.executionDomain ?? "execution",
        jobType: effectiveJobType,
        targetContract: effectiveTargetContract,
        targetSelector: effectiveTargetSelector,
        payload: effectivePayload,
        status,
        failureReason,
        providerJobRef: `${config.managedSignerProvider}:${jobId}`,
        userId: scoped.userId,
        vaultId: scoped.vaultId,
        policyVersion: scoped.policyVersion,
      });

      if (status !== "blocked" && effectiveTargetContract && effectiveCalldata) {
        try {
          const txHash = await managedSigner.signAndSendTransaction({
            to: effectiveTargetContract,
            data: effectiveCalldata,
            chainId: 5003,
          });

          finalJob = await dataApi.updateAutomationJob(jobId, {
            sessionId: body.sessionId,
            ownerEoa: scoped.ownerEoa,
            userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
            executionDomain: body.executionDomain ?? "execution",
            jobType: effectiveJobType,
            targetContract: effectiveTargetContract,
            targetSelector: effectiveTargetSelector,
            payload: effectivePayload,
            status: "submitted",
            txHash,
            providerJobRef: `${config.managedSignerProvider}:${jobId}`,
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });

          const confirmedAt = await waitForConfirmation(txHash as `0x${string}`);

          finalJob = await dataApi.updateAutomationJob(jobId, {
            sessionId: body.sessionId,
            ownerEoa: scoped.ownerEoa,
            userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
            executionDomain: body.executionDomain ?? "execution",
            jobType: effectiveJobType,
            targetContract: effectiveTargetContract,
            targetSelector: effectiveTargetSelector,
            payload: effectivePayload,
            status: "confirmed",
            txHash,
            confirmedAt,
            providerJobRef: `${config.managedSignerProvider}:${jobId}`,
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });
        } catch (error) {
          finalJob = await dataApi.updateAutomationJob(jobId, {
            sessionId: body.sessionId,
            ownerEoa: scoped.ownerEoa,
            userSmartAccount: body.vaultAddress?.toLowerCase() || scoped.vaultAddress,
            executionDomain: body.executionDomain ?? "execution",
            jobType: effectiveJobType,
            targetContract: effectiveTargetContract,
            targetSelector: effectiveTargetSelector,
            payload: effectivePayload,
            status: "failed",
            failureReason: error instanceof Error ? error.message : String(error),
            providerJobRef: `${config.managedSignerProvider}:${jobId}`,
            userId: scoped.userId,
            vaultId: scoped.vaultId,
            policyVersion: scoped.policyVersion,
          });
        }
      }

      sendJson(response, 200, {
        success: true,
        job: finalJob,
        executionCapable: capabilities.canExecute,
      });
      return;
    }

    sendJson(response, 404, { error: "Endpoint not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown executor error";
    sendJson(response, 500, { error: message });
  }
}).listen(config.port, () => {
  console.log(`NeuralRate executor listening on http://127.0.0.1:${config.port}`);
});
