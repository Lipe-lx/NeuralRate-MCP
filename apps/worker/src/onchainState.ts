import { createPublicClient, defineChain, getContract, http, type Address } from "viem";

const policyRegistryAbi = [
  {
    type: "function",
    name: "getActivePolicy",
    stateMutability: "view",
    inputs: [{ name: "vaultAddress", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "policyId", type: "bytes32" },
        { name: "ownerEoa", type: "address" },
        { name: "vaultAddress", type: "address" },
        { name: "delegate", type: "address" },
        { name: "maxPerUse", type: "uint256" },
        { name: "maxDaily", type: "uint256" },
        { name: "maxTotal", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validUntil", type: "uint256" },
        { name: "maxSlippageBps", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "active", type: "bool" },
        { name: "requireSnapshot", type: "bool" },
        { name: "hasTargetAllowlist", type: "bool" },
        { name: "hasSelectorAllowlist", type: "bool" },
        { name: "policyVersion", type: "string" },
      ],
    }],
  },
  {
    type: "function",
    name: "getAllowedAssets",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "bytes32" }],
    outputs: [{ name: "", type: "string[]" }],
  },
  {
    type: "function",
    name: "getAllowedProtocols",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "bytes32" }],
    outputs: [{ name: "", type: "string[]" }],
  },
  {
    type: "function",
    name: "getAllowedTargets",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "bytes32" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getAllowedSelectors",
    stateMutability: "view",
    inputs: [{ name: "policyId", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes4[]" }],
  },
] as const;

const safeModuleStatusAbi = [
  {
    type: "function",
    name: "isModuleEnabled",
    stateMutability: "view",
    inputs: [{ name: "module", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getFallbackHandler",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "handler", type: "address" }],
  },
  {
    type: "function",
    name: "getModuleGuard",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "guard", type: "address" }],
  },
] as const;

const delegateValidatorAbi = [
  {
    type: "function",
    name: "getDelegate",
    stateMutability: "view",
    inputs: [{ name: "smartAccount", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

type RuntimeEnv = {
  MANTLE_SEPOLIA_RPC_URL?: string;
  NEURALRATE_CHAIN_ID?: string;
  NEURALRATE_CHAIN_NAME?: string;
  NEURALRATE_POLICY_REGISTRY_CONTRACT?: string;
  NEURALRATE_EXECUTION_GUARD_CONTRACT?: string;
  NEURALRATE_SAFE_4337_MODULE_ADDRESS?: string;
  NEURALRATE_SAFE_7579_ADAPTER_ADDRESS?: string;
  NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS?: string;
  NEURALRATE_DELEGATE_VALIDATOR_ADDRESS?: string;
  NEURALRATE_4337_ENTRYPOINT_ADDRESS?: string;
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?: string;
  NEURALRATE_VAULT_MODULE_ADDRESS?: string;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};
const normalizeTextList = (values: unknown) =>
  Array.isArray(values)
    ? values.map((value) => String(value).trim().toUpperCase()).filter(Boolean)
    : [];
const normalizeAddressList = (values: unknown) =>
  Array.isArray(values)
    ? values.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    : [];

const sameStringSet = (left: string[], right: string[]) => {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
};

const buildPublicClient = (env: RuntimeEnv) => {
  const rpcUrl = env.MANTLE_SEPOLIA_RPC_URL?.trim() || "https://rpc.sepolia.mantle.xyz";
  const chainId = Number.parseInt(env.NEURALRATE_CHAIN_ID || "", 10);
  const runtimeChainId = Number.isFinite(chainId) ? chainId : 5003;
  const runtimeChainName = env.NEURALRATE_CHAIN_NAME?.trim() || "Mantle Sepolia";

  return createPublicClient({
    chain: defineChain({
      id: runtimeChainId,
      name: runtimeChainName,
      nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    }),
    transport: http(rpcUrl),
  });
};

export async function withOnchainPolicyState<T extends Record<string, unknown>>(state: T, env: RuntimeEnv) {
  const vaultAddress = asString((state.vault as Record<string, unknown> | null)?.vault_address);
  const policyRegistryAddress = env.NEURALRATE_POLICY_REGISTRY_CONTRACT?.trim();

  let onchainPolicy: Record<string, unknown> | null = null;
  let runtimeState: Record<string, unknown> | null = null;

  if (vaultAddress) {
    try {
      const publicClient = buildPublicClient(env);

      if (policyRegistryAddress) {
        const contract = getContract({
          address: policyRegistryAddress as Address,
          abi: policyRegistryAbi,
          client: publicClient,
        });
        const policy = await contract.read.getActivePolicy([vaultAddress as Address]);
        if (policy.active && policy.policyId !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          const [allowedAssets, allowedProtocols, allowedTargets, allowedSelectors] = await Promise.all([
            contract.read.getAllowedAssets([policy.policyId]),
            contract.read.getAllowedProtocols([policy.policyId]),
            contract.read.getAllowedTargets([policy.policyId]),
            contract.read.getAllowedSelectors([policy.policyId]),
          ]);

          onchainPolicy = {
            policyId: policy.policyId,
            ownerEoa: policy.ownerEoa.toLowerCase(),
            vaultAddress: policy.vaultAddress.toLowerCase(),
            delegate: policy.delegate.toLowerCase(),
            maxPerUse: policy.maxPerUse.toString(),
            maxDaily: policy.maxDaily.toString(),
            maxTotal: policy.maxTotal.toString(),
            validAfter: Number(policy.validAfter),
            validUntil: Number(policy.validUntil),
            maxSlippageBps: Number(policy.maxSlippageBps),
            requireSnapshot: policy.requireSnapshot,
            hasTargetAllowlist: policy.hasTargetAllowlist,
            hasSelectorAllowlist: policy.hasSelectorAllowlist,
            policyVersion: policy.policyVersion,
            allowedAssets: allowedAssets.map((value) => value.trim().toUpperCase()).filter(Boolean),
            allowedProtocols: allowedProtocols.map((value) => value.trim().toUpperCase()).filter(Boolean),
            allowedTargets: allowedTargets.map((value) => value.toLowerCase()),
            allowedSelectors: allowedSelectors.map((value) => value.toLowerCase()),
          };
        }
      }

      const [vaultCode, vaultModuleEnabled, safe7579Enabled, fallbackHandler, moduleGuard, installedDelegate] = await Promise.all([
        publicClient.getCode({ address: vaultAddress as Address }).catch(() => undefined),
        env.NEURALRATE_VAULT_MODULE_ADDRESS
          ? publicClient.readContract({
              address: vaultAddress as Address,
              abi: safeModuleStatusAbi,
              functionName: "isModuleEnabled",
              args: [env.NEURALRATE_VAULT_MODULE_ADDRESS as Address],
            }).catch(() => false)
          : Promise.resolve(false),
        env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS
          ? publicClient.readContract({
              address: vaultAddress as Address,
              abi: safeModuleStatusAbi,
              functionName: "isModuleEnabled",
              args: [env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS as Address],
            }).catch(() => false)
          : Promise.resolve(false),
        publicClient.readContract({
          address: vaultAddress as Address,
          abi: safeModuleStatusAbi,
          functionName: "getFallbackHandler",
        }).catch(() => ZERO_ADDRESS),
        publicClient.readContract({
          address: vaultAddress as Address,
          abi: safeModuleStatusAbi,
          functionName: "getModuleGuard",
        }).catch(() => ZERO_ADDRESS),
        env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS
          ? publicClient.readContract({
              address: env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS as Address,
              abi: delegateValidatorAbi,
              functionName: "getDelegate",
              args: [vaultAddress as Address],
            }).catch(() => ZERO_ADDRESS)
          : Promise.resolve(ZERO_ADDRESS),
      ]);

      runtimeState = {
        safeDeployed: Boolean(vaultCode && vaultCode !== "0x"),
        vaultModuleEnabled: Boolean(vaultModuleEnabled),
        safe7579Enabled: Boolean(safe7579Enabled),
        fallbackHandler: String(fallbackHandler).toLowerCase(),
        fallbackHandlerReady: env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS
          ? String(fallbackHandler).toLowerCase() === env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS.toLowerCase()
          : false,
        moduleGuard: String(moduleGuard).toLowerCase(),
        moduleGuardReady: env.NEURALRATE_EXECUTION_GUARD_CONTRACT
          ? String(moduleGuard).toLowerCase() === env.NEURALRATE_EXECUTION_GUARD_CONTRACT.toLowerCase()
          : false,
        installedDelegate: String(installedDelegate).toLowerCase(),
        delegateReady: env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS
          ? String(installedDelegate).toLowerCase() === env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS.toLowerCase()
          : false,
      };
    } catch {
      onchainPolicy = null;
      runtimeState = null;
    }
  }

  const draftConfig = (state.config as Record<string, unknown> | null) ?? null;
  const draftPolicy = draftConfig ? {
    policyVersion: asString(draftConfig.policy_version),
    maxPerUse: asNumber(draftConfig.max_action_usd),
    maxDaily: asNumber(draftConfig.max_daily_usd),
    maxTotal: asNumber(draftConfig.max_automation_usd),
    maxSlippageBps: asNumber(draftConfig.max_slippage_bps),
    allowedAssets: normalizeTextList(draftConfig.allowed_assets),
    allowedProtocols: normalizeTextList(draftConfig.allowed_protocols),
    requireSnapshot: true,
  } : null;

  const activeOnchainPolicy = onchainPolicy;
  let policySyncStatus: "not_published" | "in_sync" | "drifted" | "pending_publish" | "pending_revoke" = "not_published";
  if (draftPolicy && !activeOnchainPolicy) {
    policySyncStatus = "pending_publish";
  } else if (draftPolicy && activeOnchainPolicy) {
    const inSync =
      asString(activeOnchainPolicy.policyVersion) === draftPolicy.policyVersion &&
      asNumber(activeOnchainPolicy.maxPerUse) === draftPolicy.maxPerUse &&
      asNumber(activeOnchainPolicy.maxDaily) === draftPolicy.maxDaily &&
      asNumber(activeOnchainPolicy.maxTotal) === draftPolicy.maxTotal &&
      asNumber(activeOnchainPolicy.maxSlippageBps) === draftPolicy.maxSlippageBps &&
      Boolean(activeOnchainPolicy.requireSnapshot) === draftPolicy.requireSnapshot &&
      sameStringSet(normalizeTextList(activeOnchainPolicy.allowedAssets), draftPolicy.allowedAssets) &&
      sameStringSet(normalizeTextList(activeOnchainPolicy.allowedProtocols), draftPolicy.allowedProtocols);

    policySyncStatus = inSync ? "in_sync" : "drifted";
  }

  return {
    ...state,
    draftPolicy,
    activeOnchainPolicy,
    policySyncStatus,
    onchainPolicy: activeOnchainPolicy,
    runtimeState,
    aa: {
      policyRegistryContract: env.NEURALRATE_POLICY_REGISTRY_CONTRACT ?? null,
      executionGuardContract: env.NEURALRATE_EXECUTION_GUARD_CONTRACT ?? null,
      safe4337ModuleAddress: env.NEURALRATE_SAFE_4337_MODULE_ADDRESS ?? null,
      safe7579AdapterAddress: env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS ?? null,
      safe7579LaunchpadAddress: env.NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS ?? null,
      delegateValidatorAddress: env.NEURALRATE_DELEGATE_VALIDATOR_ADDRESS ?? null,
      entryPointAddress: env.NEURALRATE_4337_ENTRYPOINT_ADDRESS ?? null,
      authorityModel: "safe-first-aa",
    },
  };
}
