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
] as const;

const asString = (value: unknown) => (typeof value === "string" ? value : "");

export async function withOnchainPolicyState<T extends Record<string, unknown>>(state: T, env: {
  MANTLE_SEPOLIA_RPC_URL?: string;
  NEURALRATE_POLICY_REGISTRY_CONTRACT?: string;
  NEURALRATE_EXECUTION_GUARD_CONTRACT?: string;
  NEURALRATE_SAFE_4337_MODULE_ADDRESS?: string;
  NEURALRATE_SAFE_7579_ADAPTER_ADDRESS?: string;
}) {
  const vaultAddress = asString((state.vault as Record<string, unknown> | null)?.vault_address);
  const policyRegistryAddress = env.NEURALRATE_POLICY_REGISTRY_CONTRACT?.trim();
  const rpcUrl = env.MANTLE_SEPOLIA_RPC_URL?.trim() || "https://rpc.sepolia.mantle.xyz";

  let onchainPolicy: Record<string, unknown> | null = null;
  if (policyRegistryAddress && vaultAddress) {
    try {
      const publicClient = createPublicClient({
        chain: defineChain({
          id: 5003,
          name: "Mantle Sepolia",
          nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
          rpcUrls: { default: { http: [rpcUrl] } },
        }),
        transport: http(rpcUrl),
      });

      const contract = getContract({
        address: policyRegistryAddress as Address,
        abi: policyRegistryAbi,
        client: publicClient,
      });
      const policy = await contract.read.getActivePolicy([vaultAddress as Address]);
      if (policy.active) {
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
        };
      }
    } catch {
      onchainPolicy = null;
    }
  }

  return {
    ...state,
    onchainPolicy,
    aa: {
      policyRegistryContract: env.NEURALRATE_POLICY_REGISTRY_CONTRACT ?? null,
      executionGuardContract: env.NEURALRATE_EXECUTION_GUARD_CONTRACT ?? null,
      safe4337ModuleAddress: env.NEURALRATE_SAFE_4337_MODULE_ADDRESS ?? null,
      safe7579AdapterAddress: env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS ?? null,
      authorityModel: "safe-first-aa",
    },
  };
}
