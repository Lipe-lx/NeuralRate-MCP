import { encodeFunctionData, getContract, keccak256, stringToHex, type Address, type Hex } from "viem";
import type { ManagedSigner } from "./managedSigner.js";
import { getExecutorRuntime } from "./runtime.js";
import { compactExecutorError } from "./errors.js";

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
  allowedAssets: string[];
  allowedProtocols: string[];
  allowedTargets: string[];
  allowedSelectors: string[];
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

export const buildAnchorSnapshotCalldata = (args: {
  vaultAddress: string;
  snapshotHash: Hex;
  snapshotCid?: string | null;
  descriptor?: string | null;
}) =>
  encodeFunctionData({
    abi: policyRegistryAbi,
    functionName: "anchorSnapshot",
    args: [
      args.vaultAddress as Address,
      args.snapshotHash,
      args.snapshotCid ?? args.snapshotHash,
      args.descriptor ?? "neuralrate-snapshot",
    ],
  });

export async function getActivePolicy(vaultAddress: string): Promise<OnchainActivePolicy> {
  const { config, publicClient } = getExecutorRuntime();
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

  const [allowedAssets, allowedProtocols, allowedTargets, allowedSelectors] = await Promise.all([
    contract.read.getAllowedAssets([policy.policyId]),
    contract.read.getAllowedProtocols([policy.policyId]),
    contract.read.getAllowedTargets([policy.policyId]),
    contract.read.getAllowedSelectors([policy.policyId]),
  ]);

  return {
    policyId: policy.policyId,
    ownerEoa: policy.ownerEoa.toLowerCase(),
    vaultAddress: policy.vaultAddress.toLowerCase(),
    delegate: policy.delegate.toLowerCase(),
    maxPerUse: policy.maxPerUse / 10n ** 18n,
    maxDaily: policy.maxDaily / 10n ** 18n,
    maxTotal: policy.maxTotal / 10n ** 18n,
    validAfter: policy.validAfter,
    validUntil: policy.validUntil,
    maxSlippageBps: policy.maxSlippageBps,
    active: policy.active,
    requireSnapshot: policy.requireSnapshot,
    hasTargetAllowlist: policy.hasTargetAllowlist,
    hasSelectorAllowlist: policy.hasSelectorAllowlist,
    policyVersion: policy.policyVersion,
    allowedAssets: allowedAssets.map((value: string) => value.trim().toUpperCase()).filter(Boolean),
    allowedProtocols: allowedProtocols.map((value: string) => value.trim().toUpperCase()).filter(Boolean),
    allowedTargets: allowedTargets.map((value: string) => value.toLowerCase()),
    allowedSelectors: allowedSelectors.map((value: string) => value.toLowerCase()),
  };
}

export async function ensureAnchoredSnapshot(args: {
  signer: ManagedSigner;
  vaultAddress: string;
  snapshotHash?: string | null;
  snapshotCid?: string | null;
  descriptor?: string | null;
  mode?: "submit" | "read-only";
}) {
  const { config, publicClient } = getExecutorRuntime();
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
  if (args.mode === "read-only" || !capabilities.canExecute) {
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

  try {
    await args.signer.signAndSendTransaction({
      to: config.policyRegistryContract,
      data: calldata,
      chainId: config.chainId,
    });
  } catch (error) {
    throw new Error(compactExecutorError(error, "Snapshot anchoring failed"));
  }

  return { anchored: true, snapshotHash: normalizedHash };
}
