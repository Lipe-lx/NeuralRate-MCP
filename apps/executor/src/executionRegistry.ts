import { encodeFunctionData, isAddress, keccak256, parseUnits, stringToHex, toFunctionSelector, type Address, type Hex } from "viem";
import { safeJsonStringify } from "./json.js";
import { usdyStrategyDeployment } from "./generated/usdyStrategyDeployment.js";
import { vaultModuleDeployment } from "./generated/vaultModuleDeployment.js";

const parsedChainId =
  typeof process !== "undefined" ? Number.parseInt(process.env.NEURALRATE_CHAIN_ID || "", 10) : Number.NaN;
const MANTLE_SEPOLIA_CHAIN_ID = Number.isFinite(parsedChainId) ? parsedChainId : 5003;

export type TokenManifest = {
  symbol: string;
  chainId: number;
  aliases: string[];
  riskClass: "RWA_TBILL" | "STABLE" | "SYNTHETIC" | "NATIVE_GAS";
  kind: "erc20" | "native";
  decimals: number;
  address: Address | null;
};

export type ProtocolActionManifest = {
  actionId: string;
  functionName: string;
  abi: readonly [{
    type: "function";
    name: string;
    stateMutability: "nonpayable" | "payable" | "view";
    inputs: readonly {
      name: string;
      type: string;
    }[];
    outputs: readonly {
      name?: string;
      type: string;
    }[];
  }];
  selector: Hex;
};

export type ProtocolManifest = {
  protocolId: string;
  displayName: string;
  policyProtocolId: string;
  chainId: number;
  address: Address | null;
  expectedBytecodeHash: Hex | null;
  deploymentStatus: "pinned" | "unpinned";
  supportedAssets: string[];
  actions: Record<string, ProtocolActionManifest>;
};

export type StrategyIntent = {
  targetAsset: string;
  amountUsd: number;
  amountToken?: number | null;
  recipientAddress?: string | null;
  protocolHint?: string | null;
  positionId?: string | null;
  spenderAddress?: string | null;
  slippageBps?: number | null;
  notes?: string | null;
  snapshotHash?: string | null;
  snapshotCid?: string | null;
  deadline?: string | null;
};

const runtimeAddress = (value: string | undefined | null) =>
  value && isAddress(value) ? value : null;

const runtimeEnv =
  typeof globalThis !== "undefined" && "process" in globalThis
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;

const configuredUsdYTokenAddress = runtimeAddress(runtimeEnv?.NEURALRATE_USDY_TOKEN_ADDRESS);
const configuredUsdYRecipientAddress = runtimeAddress(runtimeEnv?.NEURALRATE_USDY_STRATEGY_RECIPIENT_ADDRESS);
const configuredMntRecipientAddress = runtimeAddress(runtimeEnv?.NEURALRATE_MNT_STRATEGY_RECIPIENT_ADDRESS);
export const CANONICAL_SEPOLIA_USDY_VENUE_REASON =
  "Canonical Sepolia venue for USDY is not configured. NeuralRate will not simulate an Ondo venue on testnet.";

export type StrategyManifest = {
  strategyKey: string;
  label: string;
  chainId: number;
  supportedAssets: string[];
  supportedProtocols: string[];
  defaultProtocolId: string;
  defaultActionId: string;
  maxSlippageBps: number;
  validateIntent: (intent: StrategyIntent) => string[];
};

export type PolicyCheckResult = {
  check: string;
  ok: boolean;
  detail: string;
};

export type BytecodeValidationResult = {
  status: "validated" | "deployment-unpinned" | "address-missing" | "code-missing" | "hash-mismatch" | "chain-mismatch";
  ok: boolean;
  observedBytecodeHash: Hex | null;
  detail: string;
};

export type ResolvedExecutionPlan = {
  strategyKey: string;
  strategyLabel: string;
  protocolId: string;
  actionId: string;
  targetAsset: string;
  targetContract: Address | null;
  targetSelector: Hex;
  resolvedArgs: readonly unknown[];
  calldata: Hex | null;
  executionSummary: string;
  riskFlags: string[];
  policyChecks: PolicyCheckResult[];
  bytecodeValidation: BytecodeValidationResult;
  validationStatus: "ready" | "blocked";
  validationReason: string | null;
  intent: StrategyIntent;
};

export const tokenRegistry: Record<string, TokenManifest> = {
  USDY: {
    symbol: "USDY",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    aliases: ["usdy", "ondo-usdy"],
    riskClass: "RWA_TBILL",
    kind: "erc20",
    decimals: 18,
    address: configuredUsdYTokenAddress,
  },
  MNT: {
    symbol: "MNT",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    aliases: ["mnt", "mantle"],
    riskClass: "NATIVE_GAS",
    kind: "native",
    decimals: 18,
    address: null,
  },
};

const getUsdYTokenAddress = () => tokenRegistry.USDY.address ?? configuredUsdYTokenAddress;

const usdyStableAllocationAbi = [{
  type: "function",
  name: "executeUsdYStableAllocation",
  stateMutability: "nonpayable",
  inputs: [
    { name: "ownerEoa", type: "address" },
    { name: "vaultAddress", type: "address" },
    { name: "amountUsd", type: "uint256" },
    { name: "slippageBps", type: "uint16" },
    { name: "intentHash", type: "bytes32" },
  ] as const,
  outputs: [] as const,
}] as const;

const vaultExecutionModuleAbi = [{
  type: "function",
  name: "executeVaultCall",
  stateMutability: "nonpayable",
  inputs: [
    { name: "ownerEoa", type: "address" },
    { name: "vaultAddress", type: "address" },
    { name: "targetContract", type: "address" },
    { name: "value", type: "uint256" },
    { name: "callData", type: "bytes" },
    { name: "intentHash", type: "bytes32" },
    { name: "snapshotHash", type: "bytes32" },
    { name: "slippageBps", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ] as const,
  outputs: [{ name: "", type: "bool" }] as const,
}] as const;

const erc20TransferAbi = [{
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ] as const,
  outputs: [{ name: "", type: "bool" }] as const,
}] as const;

const erc20ApproveAbi = [{
  type: "function",
  name: "approve",
  stateMutability: "nonpayable",
  inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ] as const,
  outputs: [{ name: "", type: "bool" }] as const,
}] as const;

export const protocolRegistry: Record<string, ProtocolManifest> = {
  "neuralrate-usdy-adapter-v1": {
    protocolId: "neuralrate-usdy-adapter-v1",
    displayName: "NeuralRate USDY Strategy Adapter",
    policyProtocolId: "neuralrate-usdy-adapter",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    address: usdyStrategyDeployment.address,
    expectedBytecodeHash: usdyStrategyDeployment.expectedBytecodeHash,
    deploymentStatus: usdyStrategyDeployment.deploymentStatus,
    supportedAssets: ["USDY"],
    actions: {
      "execute-usdy-stable-allocation": {
        actionId: "execute-usdy-stable-allocation",
        functionName: "executeUsdYStableAllocation",
        abi: usdyStableAllocationAbi,
        selector: toFunctionSelector("executeUsdYStableAllocation(address,address,uint256,uint16,bytes32)"),
      },
    },
  },
  "neuralrate-vault-module-v1": {
    protocolId: "neuralrate-vault-module-v1",
    displayName: "NeuralRate Vault Execution Module",
    policyProtocolId: "neuralrate-vault-module",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    address: vaultModuleDeployment.address,
    expectedBytecodeHash: vaultModuleDeployment.expectedBytecodeHash,
    deploymentStatus: vaultModuleDeployment.deploymentStatus,
    supportedAssets: ["USDY", "MNT"],
    actions: {
      "execute-vault-call": {
        actionId: "execute-vault-call",
        functionName: "executeVaultCall",
        abi: vaultExecutionModuleAbi,
        selector: toFunctionSelector("executeVaultCall(address,address,address,uint256,bytes,bytes32)"),
      },
    },
  },
};

export const strategyRegistry: Record<string, StrategyManifest> = {
  "usdy-stable-allocation": {
    strategyKey: "usdy-stable-allocation",
    label: "USDY Safe Module Allocation",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    supportedAssets: ["USDY"],
    supportedProtocols: ["neuralrate-vault-module"],
    defaultProtocolId: "neuralrate-vault-module-v1",
    defaultActionId: "execute-vault-call",
    maxSlippageBps: 100,
    validateIntent: (intent) => {
      const failures: string[] = [];
      if (!Number.isFinite(intent.amountUsd) || intent.amountUsd <= 0) {
        failures.push("amountUsd must be a positive number.");
      } else if (!Number.isInteger(intent.amountUsd)) {
        failures.push("amountUsd must be provided as a whole USD integer in v1.");
      }
      const normalizedAsset = intent.targetAsset.trim().toUpperCase();
      if (normalizedAsset !== "USDY") {
        failures.push("USDY stable allocation currently supports only the USDY asset.");
      }
      if (
        intent.slippageBps !== null &&
        intent.slippageBps !== undefined &&
        (!Number.isInteger(intent.slippageBps) || intent.slippageBps < 0 || intent.slippageBps > 100)
      ) {
        failures.push("slippageBps must be an integer between 0 and 100.");
      }
      return failures;
    },
  },
  "mnt-native-transfer": {
    strategyKey: "mnt-native-transfer",
    label: "MNT Safe Module Transfer",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    supportedAssets: ["MNT"],
    supportedProtocols: ["neuralrate-vault-module"],
    defaultProtocolId: "neuralrate-vault-module-v1",
    defaultActionId: "execute-vault-call",
    maxSlippageBps: 0,
    validateIntent: (intent) => {
      const failures: string[] = [];
      if (!Number.isFinite(intent.amountUsd) || intent.amountUsd <= 0) {
        failures.push("amountUsd must be a positive number for policy accounting.");
      }
      if (
        intent.amountToken !== null &&
        intent.amountToken !== undefined &&
        (!Number.isFinite(intent.amountToken) || intent.amountToken <= 0)
      ) {
        failures.push("amountToken must be a positive number when provided.");
      }
      if (
        intent.recipientAddress !== null &&
        intent.recipientAddress !== undefined &&
        !isAddress(intent.recipientAddress)
      ) {
        failures.push("recipientAddress must be a valid EVM address when provided.");
      }
      const normalizedAsset = intent.targetAsset.trim().toUpperCase();
      if (normalizedAsset !== "MNT") {
        failures.push("MNT native transfer currently supports only the MNT asset.");
      }
      if (
        intent.slippageBps !== null &&
        intent.slippageBps !== undefined &&
        intent.slippageBps !== 0
      ) {
        failures.push("slippageBps must be omitted or 0 for native MNT transfers.");
      }
      return failures;
    },
  },
  "usdy-vault-transfer": {
    strategyKey: "usdy-vault-transfer",
    label: "USDY Safe Module Transfer",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    supportedAssets: ["USDY"],
    supportedProtocols: ["neuralrate-vault-module"],
    defaultProtocolId: "neuralrate-vault-module-v1",
    defaultActionId: "execute-vault-call",
    maxSlippageBps: 0,
    validateIntent: (intent) => {
      const failures: string[] = [];
      if (!Number.isFinite(intent.amountUsd) || intent.amountUsd <= 0) {
        failures.push("amountUsd must be a positive number for policy accounting.");
      }
      if (
        intent.amountToken !== null &&
        intent.amountToken !== undefined &&
        (!Number.isFinite(intent.amountToken) || intent.amountToken <= 0)
      ) {
        failures.push("amountToken must be a positive number when provided.");
      }
      if (!intent.recipientAddress || !isAddress(intent.recipientAddress)) {
        failures.push("recipientAddress must be a valid EVM address for USDY transfers.");
      }
      const normalizedAsset = intent.targetAsset.trim().toUpperCase();
      if (normalizedAsset !== "USDY") {
        failures.push("USDY transfer currently supports only the USDY asset.");
      }
      if (
        intent.slippageBps !== null &&
        intent.slippageBps !== undefined &&
        intent.slippageBps !== 0
      ) {
        failures.push("slippageBps must be omitted or 0 for USDY transfers.");
      }
      return failures;
    },
  },
  "usdy-approve-spender": {
    strategyKey: "usdy-approve-spender",
    label: "USDY Safe Module Approve",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    supportedAssets: ["USDY"],
    supportedProtocols: ["neuralrate-vault-module"],
    defaultProtocolId: "neuralrate-vault-module-v1",
    defaultActionId: "execute-vault-call",
    maxSlippageBps: 0,
    validateIntent: (intent) => {
      const failures: string[] = [];
      if (!Number.isFinite(intent.amountUsd) || intent.amountUsd <= 0) {
        failures.push("amountUsd must be a positive number for policy accounting.");
      }
      if (
        intent.amountToken !== null &&
        intent.amountToken !== undefined &&
        (!Number.isFinite(intent.amountToken) || intent.amountToken <= 0)
      ) {
        failures.push("amountToken must be a positive number when provided.");
      }
      if (!intent.spenderAddress || !isAddress(intent.spenderAddress)) {
        failures.push("spenderAddress must be a valid EVM address for approvals.");
      }
      const normalizedAsset = intent.targetAsset.trim().toUpperCase();
      if (normalizedAsset !== "USDY") {
        failures.push("USDY approval currently supports only the USDY asset.");
      }
      if (
        intent.slippageBps !== null &&
        intent.slippageBps !== undefined &&
        intent.slippageBps !== 0
      ) {
        failures.push("slippageBps must be omitted or 0 for approvals.");
      }
      return failures;
    },
  },
};

const normalizeAssetSymbol = (value: string) => value.trim().toUpperCase();

export const resolveTokenManifest = (symbolOrAlias: string) => {
  const normalized = normalizeAssetSymbol(symbolOrAlias);
  return Object.values(tokenRegistry).find((token) =>
    token.symbol === normalized || token.aliases.some((alias) => normalizeAssetSymbol(alias) === normalized),
  ) ?? null;
};

export const getApprovedExecutionPolicySurface = () => {
  const contracts = new Set<string>();
  const selectors = new Set<string>();
  const assets = new Set<string>();
  const protocols = new Set<string>();
  const strategyKeys = new Set<string>();

  for (const strategy of Object.values(strategyRegistry)) {
    strategyKeys.add(strategy.strategyKey);
    strategy.supportedAssets.forEach((asset) => assets.add(asset));
    strategy.supportedProtocols.forEach((protocolId) => protocols.add(protocolId));
  }

  if (tokenRegistry.USDY.address) {
    contracts.add(tokenRegistry.USDY.address.toLowerCase());
  }
  selectors.add("0xa9059cbb");
  selectors.add("0x095ea7b3");
  selectors.add("0x00000000");

  return {
    strategyKeys: Array.from(strategyKeys),
    allowedContracts: Array.from(contracts),
    allowedSelectors: Array.from(selectors),
    allowedAssets: Array.from(assets),
    allowedProtocols: Array.from(protocols),
  };
};

export const makeIntentHash = (payload: Record<string, unknown>) => {
  const serialized = safeJsonStringify(payload);
  return keccak256(stringToHex(serialized));
};

export const safeModuleStatusAbi = [{
  type: "function",
  name: "isModuleEnabled",
  stateMutability: "view",
  inputs: [{ name: "module", type: "address" }] as const,
  outputs: [{ name: "", type: "bool" }] as const,
}] as const;

export const buildUsdYStableAllocationCalldata = (args: {
  ownerEoa: Address;
  vaultAddress: Address;
  amountUsd: bigint;
  slippageBps: number;
  intentHash: Hex;
}) => {
  return encodeFunctionData({
    abi: usdyStableAllocationAbi,
    functionName: "executeUsdYStableAllocation",
    args: [
      args.ownerEoa,
      args.vaultAddress,
      args.amountUsd,
      args.slippageBps,
      args.intentHash,
    ],
  });
};

export const buildErc20TransferCalldata = (args: {
  recipient: Address;
  amount: bigint;
}) =>
  encodeFunctionData({
    abi: erc20TransferAbi,
    functionName: "transfer",
    args: [args.recipient, args.amount],
  });

export const buildErc20ApproveCalldata = (args: {
  spender: Address;
  amount: bigint;
}) =>
  encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [args.spender, args.amount],
  });

export const buildVaultExecutionModuleCalldata = (args: {
  ownerEoa: Address;
  vaultAddress: Address;
  targetContract: Address;
  value: bigint;
  callData: Hex;
  intentHash: Hex;
  snapshotHash: Hex;
  slippageBps: number;
  deadline: bigint;
}) =>
  encodeFunctionData({
    abi: vaultExecutionModuleAbi,
    functionName: "executeVaultCall",
    args: [
      args.ownerEoa,
      args.vaultAddress,
      args.targetContract,
      args.value,
      args.callData,
      args.intentHash,
      args.snapshotHash,
      BigInt(args.slippageBps),
      args.deadline,
    ],
  });

export const resolveUsdYVaultTransfer = (args: {
  ownerEoa: Address;
  vaultAddress: Address;
  amountUsd: number;
  recipientAddress?: Address | null;
  intentHash: Hex;
}) => {
  const tokenAddress = getUsdYTokenAddress();
  if (!tokenAddress) {
    throw new Error("NEURALRATE_USDY_TOKEN_ADDRESS is not configured.");
  }
  const recipientAddress = args.recipientAddress ?? configuredUsdYRecipientAddress;
  if (!recipientAddress) {
    throw new Error("A USDY recipient address is required for this transfer.");
  }

  const amount = parseUnits(String(args.amountUsd), tokenRegistry.USDY.decimals);
  const tokenCallData = buildErc20TransferCalldata({
    recipient: recipientAddress,
    amount,
  });

  return {
    targetContract: tokenAddress,
    tokenCallData,
    recipientAddress,
    amountAtomic: amount,
  };
};

export const resolveUsdYVaultApprove = (args: {
  spenderAddress: Address;
  amountUsd: number;
  amountToken?: number | null;
}) => {
  const tokenAddress = getUsdYTokenAddress();
  if (!tokenAddress) {
    throw new Error("NEURALRATE_USDY_TOKEN_ADDRESS is not configured.");
  }

  const amount = parseUnits(
    String(args.amountToken ?? args.amountUsd),
    tokenRegistry.USDY.decimals
  );
  const tokenCallData = buildErc20ApproveCalldata({
    spender: args.spenderAddress,
    amount,
  });

  return {
    targetContract: tokenAddress,
    tokenCallData,
    spenderAddress: args.spenderAddress,
    amountAtomic: amount,
  };
};

export const resolveNativeMntVaultTransfer = (args: {
  ownerEoa: Address;
  recipientAddress?: Address | null;
  amountToken?: number | null;
  amountUsd: number;
}) => {
  const recipientAddress = args.recipientAddress ?? configuredMntRecipientAddress ?? args.ownerEoa;
  const amountToken = args.amountToken ?? args.amountUsd;
  if (!Number.isFinite(amountToken) || amountToken <= 0) {
    throw new Error("A positive amountToken (or fallback amountUsd) is required for MNT transfers.");
  }

  const amountAtomic = parseUnits(String(amountToken), tokenRegistry.MNT.decimals);
  return {
    targetContract: recipientAddress,
    value: amountAtomic,
    callData: "0x" as Hex,
    recipientAddress,
    amountAtomic,
  };
};
