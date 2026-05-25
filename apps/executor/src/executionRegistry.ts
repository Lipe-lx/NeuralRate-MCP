import { encodeFunctionData, keccak256, stringToHex, toFunctionSelector, type Address, type Hex } from "viem";
import { usdyStrategyDeployment } from "./generated/usdyStrategyDeployment.js";

const MANTLE_SEPOLIA_CHAIN_ID = 5003;

export type TokenManifest = {
  symbol: string;
  chainId: number;
  aliases: string[];
  riskClass: "RWA_TBILL" | "STABLE" | "SYNTHETIC";
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
  slippageBps?: number | null;
  notes?: string | null;
};

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
    address: null,
  },
};

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
};

export const strategyRegistry: Record<string, StrategyManifest> = {
  "usdy-stable-allocation": {
    strategyKey: "usdy-stable-allocation",
    label: "USDY Stable Allocation",
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    supportedAssets: ["USDY"],
    supportedProtocols: ["neuralrate-usdy-adapter"],
    defaultProtocolId: "neuralrate-usdy-adapter-v1",
    defaultActionId: "execute-usdy-stable-allocation",
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

    const protocol = protocolRegistry[strategy.defaultProtocolId];
    if (protocol?.address) {
      contracts.add(protocol.address.toLowerCase());
    }
    const action = protocol?.actions[strategy.defaultActionId];
    if (action?.selector) {
      selectors.add(action.selector.toLowerCase());
    }
  }

  return {
    strategyKeys: Array.from(strategyKeys),
    allowedContracts: Array.from(contracts),
    allowedSelectors: Array.from(selectors),
    allowedAssets: Array.from(assets),
    allowedProtocols: Array.from(protocols),
  };
};

export const makeIntentHash = (payload: Record<string, unknown>) => {
  const serialized = JSON.stringify(payload);
  return keccak256(stringToHex(serialized));
};

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
