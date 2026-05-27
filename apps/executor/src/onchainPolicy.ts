import { createPublicClient, defineChain, encodeFunctionData, getContract, http, keccak256, stringToHex, type Address, type Hex } from "viem";
import type { ManagedSigner } from "./managedSigner.js";
import { config } from "./config.js";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [config.mantleSepoliaRpcUrl] },
  },
});

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
    name: "getSnapshotAnchor",
    stateMutability: "view",
    inputs: [{ name: "snapshotHash", type: "bytes32" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "vaultAddress", type: "address" },
        { name: "policyId", type: "bytes32" },
        { name: "anchoredBy", type: "address" },
        { name: "snapshotHash", type: "bytes32" },
        { name: "snapshotCid", type: "string" },
        { name: "descriptor", type: "string" },
        { name: "anchoredAt", type: "uint256" },
        { name: "exists", type: "bool" },
      ],
    }],
  },
  {
    type: "function",
    name: "anchorSnapshot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vaultAddress", type: "address" },
      { name: "snapshotHash", type: "bytes32" },
      { name: "snapshotCid", type: "string" },
      { name: "descriptor", type: "string" },
    ],
    outputs: [],
  },
] as const;

const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(config.mantleSepoliaRpcUrl),
});

export type OnchainActivePolicy = {
  policyId: string;
  ownerEoa: string;
  vaultAddress: string;
  delegate: string;
  maxPerUse: bigint;
  maxDaily: bigint;
  maxTotal: bigint;
  validAfter: bigint;
  validUntil: bigint;
  maxSlippageBps: bigint;
  active: boolean;
  requireSnapshot: boolean;
  hasTargetAllowlist: boolean;
  hasSelectorAllowlist: boolean;
  policyVersion: string;
} | null;

const normalizeHash = (value: string | null | undefined): Hex | null => {
  if (!value) {
    return null;
  }
  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return value as Hex;
  }
  return keccak256(stringToHex(value));
};

export async function getActivePolicy(vaultAddress: string): Promise<OnchainActivePolicy> {
  if (!config.policyRegistryContract) {
    return null;
  }

  const contract = getContract({
    address: config.policyRegistryContract as Address,
    abi: policyRegistryAbi,
    client: publicClient,
  });
  const policy = await contract.read.getActivePolicy([vaultAddress as Address]);
  if (!policy.active || policy.policyId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return null;
  }

  return {
    policyId: policy.policyId,
    ownerEoa: policy.ownerEoa.toLowerCase(),
    vaultAddress: policy.vaultAddress.toLowerCase(),
    delegate: policy.delegate.toLowerCase(),
    maxPerUse: policy.maxPerUse,
    maxDaily: policy.maxDaily,
    maxTotal: policy.maxTotal,
    validAfter: policy.validAfter,
    validUntil: policy.validUntil,
    maxSlippageBps: policy.maxSlippageBps,
    active: policy.active,
    requireSnapshot: policy.requireSnapshot,
    hasTargetAllowlist: policy.hasTargetAllowlist,
    hasSelectorAllowlist: policy.hasSelectorAllowlist,
    policyVersion: policy.policyVersion,
  };
}

export async function ensureAnchoredSnapshot(args: {
  signer: ManagedSigner;
  vaultAddress: string;
  snapshotHash?: string | null;
  snapshotCid?: string | null;
  descriptor?: string | null;
}) {
  if (!config.policyRegistryContract || !args.snapshotHash) {
    return { anchored: false, snapshotHash: null as string | null };
  }

  const normalizedHash = normalizeHash(args.snapshotHash);
  if (!normalizedHash) {
    return { anchored: false, snapshotHash: null as string | null };
  }

  const contract = getContract({
    address: config.policyRegistryContract as Address,
    abi: policyRegistryAbi,
    client: publicClient,
  });

  const existing = await contract.read.getSnapshotAnchor([normalizedHash]);
  if (existing.exists && existing.vaultAddress.toLowerCase() === args.vaultAddress.toLowerCase()) {
    return { anchored: true, snapshotHash: normalizedHash };
  }

  const capabilities = args.signer.getCapabilities();
  if (!capabilities.canExecute) {
    return { anchored: false, snapshotHash: normalizedHash };
  }

  const calldata = encodeFunctionData({
    abi: policyRegistryAbi,
    functionName: "anchorSnapshot",
    args: [
      args.vaultAddress as Address,
      normalizedHash,
      args.snapshotCid ?? args.snapshotHash,
      args.descriptor ?? "neuralrate-snapshot",
    ],
  });

  await args.signer.signAndSendTransaction({
    to: config.policyRegistryContract,
    data: calldata,
    chainId: 5003,
  });

  return { anchored: true, snapshotHash: normalizedHash };
}
