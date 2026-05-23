import { useCallback, useEffect, useState } from "react";
import type { EIP1193Provider } from "viem";
import {
  API_BASE_URL,
  EXECUTOR_BASE_URL,
  SESSION_POLICY_VERSION,
  VAULT_PROVIDER_STRATEGY,
} from "../config";
import {
  authorizeAutomationSession,
  resolveUserSafeVault,
  type PreparedAutomationSession,
} from "../lib/automation";
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

      const response = await fetchJson<{ success: boolean; state: AutomationState }>(`${API_BASE_URL}/users/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
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
      const response = await fetchJson<{ success: boolean; config: unknown }>(`${API_BASE_URL}/agent-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEoa,
          userId: state?.userId,
          vaultId: state?.vault?.vault_id,
          policyVersion: state?.config?.policy_version ?? SESSION_POLICY_VERSION,
          ...patch,
        }),
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
      await fetchJson(`${API_BASE_URL}/vault/funding-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEoa,
          amountUsd,
          source: externalWalletAddress ? "external-wallet" : "embedded-wallet",
        }),
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
      const response = await fetchJson<{ success: boolean; state: AutomationState }>(`${API_BASE_URL}/vault/ownership-ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEoa,
          userId: state.userId,
          vaultId: state.vault.vault_id,
        }),
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
      const prepared = await fetchJson<{
        success: boolean;
        sessionId: string;
        policyId: string;
        benchmarkPolicyId: string;
        policyVersion: string;
        userId: string;
        vaultId: string;
        vaultAddress: string;
        agentSessionSigner: string;
        agentSmartWallet: string;
        benchmarkContract: string;
        chainId: number;
        executionPolicy: PreparedAutomationSession["executionPolicy"];
      }>(`${EXECUTOR_BASE_URL}/v1/automation/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerEoa,
          vaultAddress: current.vault.vault_address,
          spendLimitPerUse: String(current.config?.max_action_usd ?? 1000),
          spendLimitDaily: String(current.config?.max_daily_usd ?? 2500),
          spendLimitTotal: String(current.config?.max_automation_usd ?? 10000),
          usageLimit: 25,
        }),
      });

      const activated = await authorizeAutomationSession({
        ownerAddress: ownerEoa,
        preparedSession: {
          sessionId: prepared.sessionId,
          policyId: prepared.policyId,
          benchmarkPolicyId: prepared.benchmarkPolicyId,
          policyVersion: prepared.policyVersion,
          userSmartAccount: prepared.vaultAddress,
          agentSessionSigner: prepared.agentSessionSigner,
          agentSmartWallet: prepared.agentSmartWallet,
          benchmarkContract: prepared.benchmarkContract,
          chainId: prepared.chainId,
          executionPolicy: prepared.executionPolicy,
        },
        wallet: {
          getEthereumProvider,
          signMessage,
        },
        providerUserId,
        walletProvider,
      });

      await fetchJson(`${EXECUTOR_BASE_URL}/v1/automation/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: prepared.sessionId,
          policyId: prepared.policyId,
          ownerEoa,
          vaultAddress: activated.userSmartAccount,
          grantTxHash: activated.grantTxHash,
          permissionId: activated.permissionId,
          sessionDetails: activated.sessionDetails,
          validAfter: activated.validAfter,
          validUntil: activated.validUntil,
          consentMessage: activated.consentMessage,
          consentSignature: activated.consentSignature,
          providerSessionRef: activated.providerSessionRef,
          providerPermissionRef: activated.providerPermissionRef,
        }),
      });

      await refresh(ownerEoa);
      setNotice("Automation enabled for this dedicated Safe vault.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to enable automation.";
      setError(message);
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const revokeAutomation = async () => {
    if (!ownerEoa || !state?.activeSession || !state?.vault?.vault_address) {
      throw new Error("No active automation session found.");
    }

    setBusy(true);
    setError(null);
    try {
      await fetchJson(`${EXECUTOR_BASE_URL}/v1/automation/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.activeSession.session_id,
          policyId: state.activeSession.policy_id,
          ownerEoa,
          vaultAddress: state.vault.vault_address,
          permissionId: state.activeSession.permission_id,
          sessionDetails: {
            revokedBy: ownerEoa.toLowerCase(),
            revokedAt: new Date().toISOString(),
            providerSessionRef: providerUserId ? `${walletProvider}:${providerUserId}` : null,
          },
        }),
      });
      await refresh(ownerEoa);
      setNotice("Automation revoked for this vault.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to revoke automation.";
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
  };
};
