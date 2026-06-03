import { useCallback, useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import {
  API_BASE_URL,
  DELEGATE_VALIDATOR_ADDRESS,
  ERC8004_AGENT_ID,
  DEMO_STRATEGY_KEY,
  DEMO_TARGET_ASSET,
  MANTLE_CHAIN_ID,
  SAFE_7579_ADAPTER_ADDRESS,
  SAFE_7579_LAUNCHPAD_ADDRESS,
  SESSION_POLICY_VERSION,
  VAULT_MODULE_ADDRESS,
  VAULT_MODULE_ENABLED,
  VAULT_PROVIDER_STRATEGY,
} from "../config";
import {
  disableVaultModule,
  ensureAutonomousVaultRuntime,
  ensureVaultModuleEnabled,
  resolveUserSafeVault,
} from "../lib/automation";
import { signedGetJsonFetch, signedJsonFetch } from "../lib/auth";
import { buildLocalSnapshotHash, sendPreparedTransaction, type PreparedTxRequest } from "../lib/policyRegistry";
import type { AutomationState } from "../lib/userState";

const fetchJson = async <T>(url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return (await response.json()) as T;
};

type WalletSessionContext = {
  ownerEoa: string | null;
  externalWalletAddress: string | null;
  embeddedWalletAddress: string | null;
  providerUserId: string | null;
  authStrategy: string;
  walletProvider: string;
  canPredictVault: boolean;
  getEthereumProvider: () => Promise<EIP1193Provider>;
  signMessage: (message: string) => Promise<string>;
};

type AutomationGrantChallenge = {
  ownerEoa: string;
  userId: string;
  vaultId: string;
  vaultAddress: string;
  agentSubject: string;
  policyVersion: string;
  allowedDomains: string[];
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  message: string;
};

type PreparedPolicyPublish = {
  expectedPolicy: {
    ownerEoa: string;
    vaultAddress: string;
    delegate: string;
    maxPerUse: number;
    maxDaily: number;
    maxTotal: number;
    validAfter: number;
    validUntil: number;
    maxSlippageBps: number;
    requireSnapshot: boolean;
    policyVersion: string;
    allowedAssets: string[];
    allowedProtocols: string[];
    allowedTargets: string[];
    allowedSelectors: string[];
  };
  txRequest: PreparedTxRequest;
};

type PreparedRuntimePlan = {
  actions: Array<{
    key: string;
    label: string;
    required: boolean;
    mode: string;
  }>;
};

const DEFAULT_AUTOMATION_DOMAINS = ["state", "config", "benchmark", "execution"] as const;
const AUTOMATION_RECOVERY_REFRESH_DELAYS_MS = [0, 800, 1800, 3200] as const;
const POLICY_PUBLISH_RECOVERY_DELAYS_MS = [0, 1200, 2500, 4500] as const;

const isUnknownBlockError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    message?: unknown;
    details?: unknown;
    shortMessage?: unknown;
    cause?: { message?: unknown; details?: unknown } | null;
  };

  const parts = [
    record.message,
    record.details,
    record.shortMessage,
    record.cause?.message,
    record.cause?.details,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  return /unknown block/i.test(parts);
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const isTransientPolicyPublishVerificationError = (error: unknown) => {
  if (isUnknownBlockError(error)) {
    return true;
  }

  const message = getErrorMessage(error);
  return (
    /No active on-chain policy found after publish/i.test(message) ||
    /Published on-chain policy does not match the prepared draft/i.test(message)
  );
};
const isExecutorReachabilityError = (error: unknown) => {
  const message = getErrorMessage(error);
  return (
    /EXECUTOR_BASE_URL/i.test(message) ||
    /Executor origin .*403\/1003/i.test(message) ||
    /Executor 403 Forbidden: error code: 1003/i.test(message)
  );
};

export const useNeuralRateUser = ({
  ownerEoa,
  externalWalletAddress,
  embeddedWalletAddress,
  providerUserId,
  authStrategy,
  walletProvider,
  canPredictVault,
  getEthereumProvider,
  signMessage,
}: WalletSessionContext) => {
  const [state, setState] = useState<AutomationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (targetOwner = ownerEoa) => {
    if (!targetOwner) {
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const json = await signedGetJsonFetch<AutomationState>({
        ownerEoa: targetOwner,
        signMessage,
        url: `${API_BASE_URL}/automation/state?ownerEoa=${encodeURIComponent(targetOwner)}`,
      });
      setState(json);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh user state.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ownerEoa, signMessage]);

  useEffect(() => {
    if (!ownerEoa) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refresh(ownerEoa).catch(() => {});
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [ownerEoa, refresh]);

  const bootstrap = async () => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before bootstrapping the user vault.");
    }

    setBusy(true);
    setError(null);

    try {
      let vaultAddress: string | null = null;
      if (canPredictVault) {
        const predicted = await resolveUserSafeVault(ownerEoa, {
          getEthereumProvider,
          signMessage,
        });
        vaultAddress = predicted.safeAddress.toLowerCase();
      }

      const response = await signedJsonFetch<{ success: boolean; state: AutomationState }>({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/users/bootstrap`,
        method: "POST",
        body: {
          ownerEoa,
          externalWallet: externalWalletAddress ?? ownerEoa,
          embeddedWallet: embeddedWalletAddress,
          authStrategy,
          privyUserId: providerUserId,
          providerUserRef: providerUserId ? `${walletProvider}:${providerUserId}` : null,
          walletProvider,
          vaultAddress,
          vaultProvider: VAULT_PROVIDER_STRATEGY,
          vaultKind: "dedicated-safe-vault",
          vaultStatus: vaultAddress ? "predicted" : "provisioning",
          safeDeploymentStatus: vaultAddress ? "predicted" : "pending",
          chainId: MANTLE_CHAIN_ID,
        },
      });

      setState(response.state);
      setNotice("Dedicated user Safe vault created. Fund it before enabling automation.");
      return response.state;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to bootstrap user vault.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async (patch: Record<string, unknown>) => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before updating agent settings.");
    }

    setBusy(true);
    setError(null);
    try {
      const response = await signedJsonFetch<{ success: boolean; config: unknown }>({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/agent-config`,
        method: "PATCH",
        body: {
          ownerEoa,
          userId: state?.userId,
          vaultId: state?.vault?.vault_id,
          policyVersion: state?.config?.policy_version ?? SESSION_POLICY_VERSION,
          ...patch,
        },
      });

      await refresh(ownerEoa);
      setNotice("Agent settings updated.");
      return response.config;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update agent settings.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const createFundingIntent = async (amountUsd: number) => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before preparing a funding intent.");
    }

    setBusy(true);
    setError(null);
    try {
      await signedJsonFetch({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/vault/funding-intent`,
        method: "POST",
        body: {
          ownerEoa,
          amountUsd,
          source: externalWalletAddress ? "external-wallet" : "embedded-wallet",
        },
      });
      await refresh(ownerEoa);
      setNotice("Funding intent recorded. Send funds to the vault deposit address shown below.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create funding intent.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const acknowledgeOwnership = async () => {
    if (!ownerEoa || !state?.vault?.vault_id) {
      throw new Error("Bootstrap your user vault before acknowledging wallet ownership.");
    }

    setBusy(true);
    setError(null);
    try {
      const response = await signedJsonFetch<{ success: boolean; state: AutomationState }>({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/vault/ownership-ack`,
        method: "POST",
        body: {
          ownerEoa,
          userId: state.userId,
          vaultId: state.vault.vault_id,
        },
      });

      setState(response.state);
      setNotice("Wallet ownership acknowledged. Funding and automation are now unlocked for this vault.");
      return response.state;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to acknowledge wallet ownership.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const publishDraftPolicy = async () => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before publishing policy.");
    }

    const prepared = await signedJsonFetch<PreparedPolicyPublish>({
      ownerEoa,
      signMessage,
      url: `${API_BASE_URL}/automation/policy/prepare-publish`,
      method: "POST",
      body: { ownerEoa },
    });

    const submitPublishedPolicy = async (txHash?: string | null) => {
      let lastError: unknown;

      for (let attempt = 0; attempt < POLICY_PUBLISH_RECOVERY_DELAYS_MS.length; attempt += 1) {
        const delayMs = POLICY_PUBLISH_RECOVERY_DELAYS_MS[attempt];
        if (delayMs > 0) {
          await wait(delayMs);
        }

        try {
          return await signedJsonFetch({
            ownerEoa,
            signMessage,
            url: `${API_BASE_URL}/automation/policy/submit-publish`,
            method: "POST",
            body: {
              ownerEoa,
              txHash,
              expectedPolicy: prepared.expectedPolicy,
            },
          });
        } catch (error) {
          lastError = error;
          if (!isTransientPolicyPublishVerificationError(error) || attempt === POLICY_PUBLISH_RECOVERY_DELAYS_MS.length - 1) {
            throw error;
          }
        }
      }

      throw lastError;
    };

    try {
      const txHash = await sendPreparedTransaction({
        wallet: { getEthereumProvider },
        txRequest: prepared.txRequest,
      });
      return await submitPublishedPolicy(txHash);
    } catch (error) {
      if (!isUnknownBlockError(error)) {
        throw error;
      }
      return submitPublishedPolicy();
    }
  };

  const finalizeAutomationGrant = async (current: AutomationState) => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before issuing the automation grant.");
    }

    const agentSubject = `erc8004:${ERC8004_AGENT_ID}`;
    const challengeResponse = await signedJsonFetch<{
      success: boolean;
      challenge: AutomationGrantChallenge;
    }>({
      ownerEoa,
      signMessage,
      url: `${API_BASE_URL}/automation/grants/prepare`,
      method: "POST",
      body: {
        ownerEoa,
        agentSubject,
        allowedDomains: [...DEFAULT_AUTOMATION_DOMAINS],
        policyVersion: current.config?.policy_version ?? SESSION_POLICY_VERSION,
      },
    });

    const grantSignature = await signMessage(challengeResponse.challenge.message);
    const result = await fetchJson<{
      success: boolean;
      requiresSignature: boolean;
      grantId?: string;
    }>(`${API_BASE_URL}/automation/grants/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerEoa,
        agentSubject,
        allowedDomains: challengeResponse.challenge.allowedDomains,
        policyVersion: challengeResponse.challenge.policyVersion,
        issuedAt: challengeResponse.challenge.issuedAt,
        expiresAt: challengeResponse.challenge.expiresAt,
        nonce: challengeResponse.challenge.nonce,
        signature: grantSignature,
        issuedVia: "web",
      }),
    });

    if (result.requiresSignature) {
      throw new Error("Automation grant was not finalized after signing.");
    }
  };

  const enableRuntimeFromPlan = async () => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before enabling the runtime.");
    }

    const prepared = await signedJsonFetch<PreparedRuntimePlan>({
      ownerEoa,
      signMessage,
      url: `${API_BASE_URL}/automation/runtime/prepare-enable`,
      method: "POST",
      body: { ownerEoa },
    });

    const txHashes: Record<string, string> = {};
    if (prepared.actions.length > 0 && VAULT_MODULE_ENABLED) {
      const aaReady = Boolean(
        SAFE_7579_ADAPTER_ADDRESS &&
        SAFE_7579_LAUNCHPAD_ADDRESS &&
        DELEGATE_VALIDATOR_ADDRESS
      );
      if (aaReady && prepared.actions.some((action) =>
        ["install_safe7579", "configure_delegate_validator", "enable_execution_guard", "enable_fallback_handler"].includes(action.key)
      )) {
        const runtimeResult = await ensureAutonomousVaultRuntime(
          ownerEoa,
          {
            getEthereumProvider,
            signMessage,
          },
          VAULT_MODULE_ADDRESS
        );
        if (runtimeResult.deploymentTxHash) txHashes.deploy_safe = runtimeResult.deploymentTxHash;
        if (runtimeResult.moduleTxHash) txHashes.enable_vault_module = runtimeResult.moduleTxHash;
        if (runtimeResult.safe7579InstallTxHash) txHashes.install_safe7579 = runtimeResult.safe7579InstallTxHash;
        if (runtimeResult.validatorInstallTxHash) txHashes.configure_delegate_validator = runtimeResult.validatorInstallTxHash;
        if (runtimeResult.validatorRotateTxHash) txHashes.rotate_delegate_validator = runtimeResult.validatorRotateTxHash;
        if (runtimeResult.moduleGuardTxHash) txHashes.enable_execution_guard = runtimeResult.moduleGuardTxHash;
        if (runtimeResult.fallbackTxHash) txHashes.enable_fallback_handler = runtimeResult.fallbackTxHash;
      } else if (prepared.actions.some((action) => ["deploy_safe", "enable_vault_module"].includes(action.key))) {
        const moduleResult = await ensureVaultModuleEnabled(ownerEoa, {
          getEthereumProvider,
          signMessage,
        }, VAULT_MODULE_ADDRESS);
        if (moduleResult.deploymentTxHash) txHashes.deploy_safe = moduleResult.deploymentTxHash;
        if (moduleResult.moduleTxHash) txHashes.enable_vault_module = moduleResult.moduleTxHash;
      }
    }

    return signedJsonFetch({
      ownerEoa,
      signMessage,
      url: `${API_BASE_URL}/automation/runtime/submit-enable`,
      method: "POST",
      body: {
        ownerEoa,
        txHashes,
      },
    });
  };

  const disableRuntimeFromPlan = async () => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before disabling the runtime.");
    }

    const prepared = await signedJsonFetch<PreparedRuntimePlan>({
      ownerEoa,
      signMessage,
      url: `${API_BASE_URL}/automation/runtime/prepare-disable`,
      method: "POST",
      body: { ownerEoa },
    });

    const txHashes: Record<string, string> = {};
    if (prepared.actions.some((action) => action.key === "disable_vault_module") && state?.vault?.vault_address) {
      const disableTxHash = await disableVaultModule(
        ownerEoa,
        {
          getEthereumProvider,
          signMessage,
        },
        state.vault.vault_address,
        VAULT_MODULE_ADDRESS,
      );
      if (disableTxHash) {
        txHashes.disable_vault_module = disableTxHash;
      }
    }

    return signedJsonFetch({
      ownerEoa,
      signMessage,
      url: `${API_BASE_URL}/automation/runtime/submit-disable`,
      method: "POST",
      body: {
        ownerEoa,
        txHashes,
      },
    });
  };

  const enableAutomation = async () => {
    if (!ownerEoa) {
      throw new Error("Connect a wallet before enabling automation.");
    }

    const current = state ?? (await refresh(ownerEoa));
    if (!current?.vault?.vault_address) {
      throw new Error("Bootstrap your user vault first.");
    }

    setBusy(true);
    setError(null);
    try {
      if (!current.vault.ownership_acknowledged_at) {
        throw new Error("Acknowledge vault ownership before issuing an automation grant.");
      }

      await publishDraftPolicy();
      await finalizeAutomationGrant(current);

      let moduleMessage = "Grant recorded and policy synchronized.";
      if (VAULT_MODULE_ENABLED) {
        await enableRuntimeFromPlan();
        moduleMessage = "Grant recorded, policy synchronized and runtime verified on-chain.";
      }

      await refresh(ownerEoa);
      setNotice(`Automation grant issued. ${moduleMessage}`);
    } catch (err) {
      let recoveredState: AutomationState | null = null;
      for (const delayMs of AUTOMATION_RECOVERY_REFRESH_DELAYS_MS) {
        if (delayMs > 0) {
          await wait(delayMs);
        }
        recoveredState = await refresh(ownerEoa).catch(() => null);
        if (recoveredState?.activeGrant?.status === "active") {
          break;
        }
      }

      if (recoveredState?.activeGrant?.status === "active") {
        setError(null);
        if (isUnknownBlockError(err)) {
          setNotice("Automation grant issued. Runtime verification hit a transient Mantle RPC sync delay, so the app refreshed your state and kept automation enabled.");
          return;
        }
        setNotice("Automation grant issued and state recovered after refresh.");
        return;
      }

      const message = err instanceof Error ? err.message : "Failed to enable automation.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const revokeAutomation = async () => {
    if (!ownerEoa || !state?.activeGrant) {
      throw new Error("No active automation grant found.");
    }

    setBusy(true);
    setError(null);
    try {
      let moduleMessage = "";
      if (VAULT_MODULE_ENABLED) {
        await disableRuntimeFromPlan();
        moduleMessage = " Runtime disable verified on-chain.";
      }

      await signedJsonFetch({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/automation/grants/revoke`,
        method: "POST",
        body: {
          ownerEoa,
          grantId: state.activeGrant.grant_id,
        },
      });
      const preparedRevoke = await signedJsonFetch<{ txRequest: PreparedTxRequest }>({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/automation/policy/prepare-revoke`,
        method: "POST",
        body: { ownerEoa },
      });
      const txHash = await sendPreparedTransaction({
        wallet: { getEthereumProvider },
        txRequest: preparedRevoke.txRequest,
      });
      await signedJsonFetch({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/automation/policy/submit-revoke`,
        method: "POST",
        body: {
          ownerEoa,
          txHash,
        },
      });
      await refresh(ownerEoa);
      setNotice(`Automation revoked for this vault.${moduleMessage}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke automation.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const queueDemoStrategy = async () => {
    if (!ownerEoa || !state?.activeGrant || !state?.vault?.vault_address) {
      throw new Error(`Enable automation before queueing the ${DEMO_TARGET_ASSET} demo strategy.`);
    }

    setBusy(true);
    setError(null);
    try {
      const isNativeMntDemo = DEMO_TARGET_ASSET.toUpperCase() === "MNT";
      const snapshotPayload = {
        strategyKey: DEMO_STRATEGY_KEY,
        targetAsset: DEMO_TARGET_ASSET,
        riskProfile: state.config?.risk_profile ?? "medium",
        policyVersion: state.config?.policy_version ?? SESSION_POLICY_VERSION,
        createdAt: new Date().toISOString(),
      };
      const snapshotHash = buildLocalSnapshotHash(snapshotPayload);
      const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const response = await signedJsonFetch<{
        success: boolean;
        executionCapable: boolean;
        job?: {
          status?: string;
        };
      }>({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/automation/jobs`,
        method: "POST",
        body: {
          ownerEoa,
          strategyKey: DEMO_STRATEGY_KEY,
          intent: {
            targetAsset: DEMO_TARGET_ASSET,
            amountUsd: isNativeMntDemo ? 1 : state.config?.max_action_usd ?? 1000,
            amountToken: isNativeMntDemo ? 1 : undefined,
            slippageBps: isNativeMntDemo ? 0 : 50,
            snapshotHash,
            snapshotCid: `local-snapshot:${snapshotHash}`,
            deadline,
          },
        },
      });

      await refresh(ownerEoa);
      setNotice(
        response.job?.status === "blocked"
          ? `${DEMO_TARGET_ASSET} demo strategy was recorded but blocked by policy or deployment validation. Check the execution trail for the exact reason.`
          : response.executionCapable
            ? `${DEMO_TARGET_ASSET} demo strategy queued for execution inside the dedicated vault.`
            : `${DEMO_TARGET_ASSET} demo strategy was accepted, but the managed signer is not execution-capable in this environment.`,
      );
    } catch (err) {
      const message = isExecutorReachabilityError(err)
        ? "Automation is enabled, but the execution service is misconfigured or unreachable in this environment. Configure the deployed executor URL and redeploy the worker before queueing strategies."
        : err instanceof Error
          ? err.message
          : `Failed to queue the ${DEMO_TARGET_ASSET} demo strategy.`;
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  };

  return {
    state: ownerEoa ? state : null,
    loading,
    busy,
    notice,
    error,
    setNotice,
    setError,
    refresh,
    bootstrap,
    saveConfig,
    createFundingIntent,
    acknowledgeOwnership,
    enableAutomation,
    revokeAutomation,
    queueDemoStrategy,
  };
};
