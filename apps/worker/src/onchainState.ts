import { createPublicClient, defineChain, formatUnits, getContract, http, isAddress, type Address } from "viem";

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

export type RuntimeEnv = {
  MANTLE_SEPOLIA_RPC_URL?: string;
  MANTLE_SEPOLIA_RPC_FALLBACK_URL?: string;
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
  NEURALRATE_USDY_TOKEN_ADDRESS?: string;
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

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export type VaultBalanceSource = {
  id: string;
  status: "live" | "configured" | "unavailable";
  detail: string;
};

export type VaultAssetBalance = {
  asset: string;
  kind: "native" | "erc20";
  address: string | null;
  decimals: number;
  balanceRaw: string;
  balanceFormatted: string;
  hasBalance: boolean;
  valuationUsd: number | null;
  valuationSource: string | null;
  readStatus: "live" | "cached" | "unavailable";
  asOf: string | null;
};

type BalanceReadClient = {
  getBalance(args: { address: Address }): Promise<bigint>;
  readContract(args: {
    address: Address;
    abi: typeof erc20BalanceAbi;
    functionName: "balanceOf" | "decimals" | "symbol";
    args?: [Address];
  }): Promise<unknown>;
};

type VaultBalanceCacheEntry = {
  cachedAt: string;
  expiresAtMs: number;
  nativeBalance: VaultAssetBalance;
  tokenBalances: VaultAssetBalance[];
};

type VaultBalanceReadOptions = {
  cacheTtlMs?: number;
  maxAttemptsPerRpc?: number;
  retryDelayMs?: number;
  nowMs?: number;
  createClient?: (rpcUrl: string) => BalanceReadClient;
};

const DEFAULT_RPC_URL = "https://rpc.sepolia.mantle.xyz";
const DEFAULT_VAULT_BALANCE_CACHE_TTL_MS = 30_000;
const DEFAULT_RPC_ATTEMPTS = 2;
const DEFAULT_RPC_RETRY_DELAY_MS = 150;
const vaultBalanceCache = new Map<string, VaultBalanceCacheEntry>();

const sleep = async (ms: number) => {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const cloneBalance = (
  balance: VaultAssetBalance,
  overrides: Partial<Pick<VaultAssetBalance, "readStatus" | "asOf">> = {}
): VaultAssetBalance => ({
  ...balance,
  readStatus: overrides.readStatus ?? balance.readStatus,
  asOf: overrides.asOf ?? balance.asOf,
});

const resolveRpcUrls = (env: RuntimeEnv) => {
  const urls = [
    env.MANTLE_SEPOLIA_RPC_URL?.trim() || DEFAULT_RPC_URL,
    env.MANTLE_SEPOLIA_RPC_FALLBACK_URL?.trim() || "",
  ].filter(Boolean);
  return [...new Set(urls)];
};

export const buildPublicClient = (env: RuntimeEnv, rpcUrl?: string) => {
  const resolvedRpcUrl = rpcUrl?.trim() || resolveRpcUrls(env)[0] || DEFAULT_RPC_URL;
  const chainId = Number.parseInt(env.NEURALRATE_CHAIN_ID || "", 10);
  const runtimeChainId = Number.isFinite(chainId) ? chainId : 5003;
  const runtimeChainName = env.NEURALRATE_CHAIN_NAME?.trim() || "Mantle Sepolia";

  return createPublicClient({
    chain: defineChain({
      id: runtimeChainId,
      name: runtimeChainName,
      nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
      rpcUrls: { default: { http: [resolvedRpcUrl] } },
    }),
    transport: http(resolvedRpcUrl),
  });
};

const configuredTrackedAssets = (env: RuntimeEnv) => {
  const tracked: Array<{ asset: string; address: Address; decimals: number; symbol: string }> = [];
  const usdyAddress = env.NEURALRATE_USDY_TOKEN_ADDRESS?.trim();
  if (usdyAddress && isAddress(usdyAddress)) {
    tracked.push({
      asset: "USDY",
      symbol: "USDY",
      address: usdyAddress,
      decimals: 18,
    });
  }
  return tracked;
};

const resolveVaultBalanceCacheKey = (vaultAddress: string, env: RuntimeEnv) =>
  `${(env.NEURALRATE_CHAIN_ID || "5003").trim()}:${vaultAddress.toLowerCase()}`;

const getCachedVaultBalances = (vaultAddress: string, env: RuntimeEnv, nowMs: number) => {
  const cacheKey = resolveVaultBalanceCacheKey(vaultAddress, env);
  const cached = vaultBalanceCache.get(cacheKey);
  if (!cached) {
    return null;
  }
  if (cached.expiresAtMs <= nowMs) {
    vaultBalanceCache.delete(cacheKey);
    return null;
  }
  return cached;
};

const setCachedVaultBalances = (
  vaultAddress: string,
  env: RuntimeEnv,
  nowMs: number,
  cacheTtlMs: number,
  nativeBalance: VaultAssetBalance,
  tokenBalances: VaultAssetBalance[]
) => {
  const cacheKey = resolveVaultBalanceCacheKey(vaultAddress, env);
  vaultBalanceCache.set(cacheKey, {
    cachedAt: new Date(nowMs).toISOString(),
    expiresAtMs: nowMs + cacheTtlMs,
    nativeBalance: cloneBalance(nativeBalance),
    tokenBalances: tokenBalances.map((balance) => cloneBalance(balance)),
  });
};

const findCachedTokenBalance = (cached: VaultBalanceCacheEntry | null, token: { asset: string; address: Address }) =>
  cached?.tokenBalances.find((entry) =>
    entry.asset.toUpperCase() === token.asset.toUpperCase() ||
    entry.address?.toLowerCase() === token.address.toLowerCase()
  ) ?? null;

const readWithRetry = async <T>(
  rpcUrls: string[],
  createClient: (rpcUrl: string) => BalanceReadClient,
  maxAttemptsPerRpc: number,
  retryDelayMs: number,
  load: (client: BalanceReadClient) => Promise<T>
) => {
  let lastError: unknown = null;

  for (let rpcIndex = 0; rpcIndex < rpcUrls.length; rpcIndex += 1) {
    const rpcUrl = rpcUrls[rpcIndex]!;
    const client = createClient(rpcUrl);
    for (let attempt = 1; attempt <= maxAttemptsPerRpc; attempt += 1) {
      try {
        const value = await load(client);
        return { ok: true as const, value, rpcIndex, rpcUrl, attempt };
      } catch (error) {
        lastError = error;
        if (attempt < maxAttemptsPerRpc) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }
  }

  return { ok: false as const, error: lastError };
};

export const resetVaultBalanceCacheForTests = () => {
  vaultBalanceCache.clear();
};

export async function readVaultBalances(vaultAddress: string, env: RuntimeEnv, options: VaultBalanceReadOptions = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const asOf = new Date(nowMs).toISOString();
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_VAULT_BALANCE_CACHE_TTL_MS;
  const maxAttemptsPerRpc = Math.max(1, options.maxAttemptsPerRpc ?? DEFAULT_RPC_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RPC_RETRY_DELAY_MS);
  const rpcUrls = resolveRpcUrls(env);
  const createClient = options.createClient ?? ((rpcUrl: string) => buildPublicClient(env, rpcUrl) as BalanceReadClient);
  const sources: VaultBalanceSource[] = [];
  const cached = getCachedVaultBalances(vaultAddress, env, nowMs);

  const nativeRead = await readWithRetry(
    rpcUrls,
    createClient,
    maxAttemptsPerRpc,
    retryDelayMs,
    async (client) => client.getBalance({ address: vaultAddress as Address })
  );

  const nativeBalance = nativeRead.ok
    ? {
        asset: "MNT",
        kind: "native" as const,
        address: null,
        decimals: 18,
        balanceRaw: nativeRead.value.toString(),
        balanceFormatted: formatUnits(nativeRead.value, 18),
        hasBalance: nativeRead.value > 0n,
        valuationUsd: null,
        valuationSource: null,
        readStatus: "live" as const,
        asOf,
      }
    : cached?.nativeBalance
      ? cloneBalance(cached.nativeBalance, { readStatus: "cached", asOf: cached.cachedAt })
      : {
          asset: "MNT",
          kind: "native" as const,
          address: null,
          decimals: 18,
          balanceRaw: "0",
          balanceFormatted: "0",
          hasBalance: false,
          valuationUsd: null,
          valuationSource: null,
          readStatus: "unavailable" as const,
          asOf: null,
        };

  sources.push({
    id: "native_rpc_balance",
    status: nativeRead.ok ? "live" : cached?.nativeBalance ? "configured" : "unavailable",
    detail: nativeRead.ok
      ? nativeRead.rpcIndex === 0
        ? "Native vault balance read from the configured chain RPC."
        : "Native vault balance read from the fallback chain RPC after primary retries failed."
      : cached?.nativeBalance
        ? "Native vault balance could not be read from the configured chain RPCs. Returned the last successful worker-cached balance instead of reporting zero."
        : "Native vault balance could not be read from the configured chain RPCs after retries, so the live native balance is currently unknown.",
  });

  const tokenBalances = await Promise.all(
    configuredTrackedAssets(env).map(async (token) => {
      const tokenRead = await readWithRetry(
        rpcUrls,
        createClient,
        maxAttemptsPerRpc,
        retryDelayMs,
        async (client) => {
          const [balanceRaw, decimals, symbol] = await Promise.all([
            client.readContract({
              address: token.address,
              abi: erc20BalanceAbi,
              functionName: "balanceOf",
              args: [vaultAddress as Address],
            }),
            client.readContract({
              address: token.address,
              abi: erc20BalanceAbi,
              functionName: "decimals",
            }),
            client.readContract({
              address: token.address,
              abi: erc20BalanceAbi,
              functionName: "symbol",
            }),
          ]);
          return {
            balanceRaw: balanceRaw as bigint,
            decimals: Number(decimals),
            symbol: String(symbol),
          };
        }
      );

      const cachedToken = findCachedTokenBalance(cached, token);

      sources.push({
        id: `erc20_rpc_balance:${token.asset.toLowerCase()}`,
        status: tokenRead.ok ? "live" : cachedToken ? "configured" : "unavailable",
        detail: tokenRead.ok
          ? tokenRead.rpcIndex === 0
            ? `${token.asset} vault balance read from the configured chain RPC.`
            : `${token.asset} vault balance read from the fallback chain RPC after primary retries failed.`
          : cachedToken
            ? `${token.asset} vault balance could not be read from the configured chain RPCs. Returned the last successful worker-cached balance instead of reporting zero.`
            : `${token.asset} vault balance could not be read from the configured chain RPCs after retries, so the live token balance is currently unknown.`,
      });

      if (tokenRead.ok) {
        return {
          asset: String(tokenRead.value.symbol || token.asset).trim().toUpperCase() || token.asset,
          kind: "erc20" as const,
          address: token.address.toLowerCase(),
          decimals: Number(tokenRead.value.decimals),
          balanceRaw: tokenRead.value.balanceRaw.toString(),
          balanceFormatted: formatUnits(tokenRead.value.balanceRaw, Number(tokenRead.value.decimals)),
          hasBalance: tokenRead.value.balanceRaw > 0n,
          valuationUsd: null,
          valuationSource: null,
          readStatus: "live" as const,
          asOf,
        } satisfies VaultAssetBalance;
      }

      if (cachedToken) {
        return cloneBalance(cachedToken, { readStatus: "cached", asOf: cached?.cachedAt ?? cachedToken.asOf });
      }

      return {
        asset: token.asset,
        kind: "erc20" as const,
        address: token.address.toLowerCase(),
        decimals: token.decimals,
        balanceRaw: "0",
        balanceFormatted: "0",
        hasBalance: false,
        valuationUsd: null,
        valuationSource: null,
        readStatus: "unavailable" as const,
        asOf: null,
      } satisfies VaultAssetBalance;
    })
  );

  if (configuredTrackedAssets(env).length === 0) {
    sources.push({
      id: "tracked_erc20_assets",
      status: "configured",
      detail: "No tracked ERC20 assets are configured for worker-side vault balance reads.",
    });
  }

  if (nativeBalance.readStatus === "cached" || tokenBalances.some((balance) => balance.readStatus === "cached")) {
    sources.push({
      id: "vault_balance_cache",
      status: "configured",
      detail: "At least one asset balance was served from the worker's short-lived last-good cache because the live RPC read was unavailable.",
    });
  }

  const allBalancesLive = nativeBalance.readStatus === "live" && tokenBalances.every((balance) => balance.readStatus === "live");
  if (allBalancesLive) {
    setCachedVaultBalances(vaultAddress, env, nowMs, cacheTtlMs, nativeBalance, tokenBalances);
  }

  return {
    nativeBalance,
    tokenBalances,
    sources,
  };
}

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
