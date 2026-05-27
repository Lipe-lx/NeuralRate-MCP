import { useCallback, useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import {
  API_BASE_URL,
  DELEGATE_VALIDATOR_ADDRESS,
  ERC8004_AGENT_ID,
  DEMO_STRATEGY_KEY,
  DEMO_TARGET_ASSET,
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
import { signedJsonFetch } from "../lib/auth";
import { buildLocalSnapshotHash, publishActivePolicy, revokeActivePolicy } from "../lib/policyRegistry";
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

const DEFAULT_AUTOMATION_DOMAINS = ["state", "benchmark", "execution"] as const;

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
      const json = await fetchJson<AutomationState>(`${API_BASE_URL}/automation/state?ownerEoa=${encodeURIComponent(targetOwner)}`);
      setState(json);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to refresh user state.";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [ownerEoa]);

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
          chainId: 5003,
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

      if (state?.vault?.vault_address) {
        await publishActivePolicy({
          ownerEoa,
          vaultAddress: state.vault.vault_address,
          wallet: { getEthereumProvider },
          policyVersion: String((patch.policyVersion as string | undefined) ?? state?.config?.policy_version ?? SESSION_POLICY_VERSION),
          allowedAssets: Array.isArray(patch.allowedAssets) ? patch.allowedAssets.map(String) : (state?.config?.allowed_assets ?? []),
          allowedProtocols: Array.isArray(patch.allowedProtocols) ? patch.allowedProtocols.map(String) : (state?.config?.allowed_protocols ?? []),
          maxPerUse: Number((patch.maxActionUsd as number | undefined) ?? state?.config?.max_action_usd ?? 1000),
          maxDaily: Number((patch.maxDailyUsd as number | undefined) ?? state?.config?.max_daily_usd ?? 2500),
          maxTotal: Number((patch.maxAutomationUsd as number | undefined) ?? state?.config?.max_automation_usd ?? 10000),
          maxSlippageBps: Number((patch.maxSlippageBps as number | undefined) ?? state?.config?.max_slippage_bps ?? 50),
          requireSnapshot: true,
        });
      }

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

      if (current.vault.vault_address) {
        const effectivePolicy = current.config ?? {
          allowed_assets: [],
          allowed_protocols: [],
          max_action_usd: 1000,
          max_daily_usd: 2500,
          max_automation_usd: 10000,
          max_slippage_bps: 50,
          policy_version: SESSION_POLICY_VERSION,
        };

        await publishActivePolicy({
          ownerEoa,
          vaultAddress: current.vault.vault_address,
          wallet: { getEthereumProvider },
          policyVersion: effectivePolicy.policy_version,
          allowedAssets: effectivePolicy.allowed_assets,
          allowedProtocols: effectivePolicy.allowed_protocols,
          maxPerUse: effectivePolicy.max_action_usd,
          maxDaily: effectivePolicy.max_daily_usd,
          maxTotal: effectivePolicy.max_automation_usd,
          maxSlippageBps: effectivePolicy.max_slippage_bps,
          requireSnapshot: true,
        });
      }

      const agentSubject = `erc8004:${ERC8004_AGENT_ID}`;
      const challengeResponse = await signedJsonFetch<{
        success: boolean;
        challenge: AutomationGrantChallenge;
      }>({
        ownerEoa,
        signMessage,
        url: `${API_BASE_URL}/automation/grants/challenge`,
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
      }>(`${API_BASE_URL}/automation/grants/issue`, {
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

      let moduleMessage = "Grant recorded off-chain.";
      if (VAULT_MODULE_ENABLED) {
        const aaReady = Boolean(
          SAFE_7579_ADAPTER_ADDRESS &&
          SAFE_7579_LAUNCHPAD_ADDRESS &&
          DELEGATE_VALIDATOR_ADDRESS
        );
        if (aaReady) {
          const runtimeResult = await ensureAutonomousVaultRuntime(
            ownerEoa,
            {
              getEthereumProvider,
              signMessage,
            },
            VAULT_MODULE_ADDRESS
          );
          moduleMessage = runtimeResult.safe7579InstallTxHash || runtimeResult.validatorInstallTxHash
            ? "AA runtime installed on-chain with Safe7579, delegate validator and vault module."
            : "AA runtime was already installed on-chain for this vault.";
        } else {
          const moduleResult = await ensureVaultModuleEnabled(ownerEoa, {
            getEthereumProvider,
            signMessage,
          }, VAULT_MODULE_ADDRESS);
          moduleMessage = moduleResult.alreadyEnabled
            ? "Safe module was already enabled on-chain."
            : "Safe module enabled on-chain for real vault execution.";
        }
      }

      await refresh(ownerEoa);
      setNotice(`Automation grant issued. ${moduleMessage}`);
    } catch (err) {
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
      if (VAULT_MODULE_ENABLED && state.vault?.vault_address) {
        const disableTxHash = await disableVaultModule(
          ownerEoa,
          {
            getEthereumProvider,
            signMessage,
          },
          state.vault.vault_address,
          VAULT_MODULE_ADDRESS,
        );
        moduleMessage = disableTxHash
          ? " Safe module disabled on-chain."
          : " Safe module was already disabled on-chain.";
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
      if (state.vault?.vault_address) {
        await revokeActivePolicy({
          ownerEoa,
          vaultAddress: state.vault.vault_address,
          wallet: { getEthereumProvider },
        });
      }
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
      const message = err instanceof Error ? err.message : `Failed to queue the ${DEMO_TARGET_ASSET} demo strategy.`;
      setError(message);
      throw err;
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
