import {
  buildUsdYStableAllocationCalldata,
  getApprovedExecutionPolicySurface,
  makeIntentHash,
  protocolRegistry,
  resolveTokenManifest,
  strategyRegistry,
  type BytecodeValidationResult,
  type PolicyCheckResult,
  type ResolvedExecutionPlan,
  type StrategyIntent,
} from "./executionRegistry.js";
import { keccak256, parseUnits, type Address, type Hex } from "viem";

type ScopedExecutionContext = {
  ownerEoa: string;
  vaultAddress: string;
  chainId: number;
  policyVersion: string;
  maxActionUsd: number;
  maxAutomationUsd: number;
  allowedAssets: string[];
  allowedProtocols: string[];
};

type PublicClientLike = {
  getCode(args: { address: Address }): Promise<Hex | undefined>;
};

const normalizeList = (values: string[]) => values.map((value) => value.trim().toUpperCase()).filter(Boolean);

const unique = (values: string[]) => Array.from(new Set(values));

const makePolicyCheck = (check: string, ok: boolean, detail: string): PolicyCheckResult => ({
  check,
  ok,
  detail,
});

export const validateProtocolDeployment = async (
  publicClient: PublicClientLike,
  protocolId: string,
  chainId: number,
): Promise<BytecodeValidationResult> => {
  const protocol = protocolRegistry[protocolId];
  if (!protocol) {
    return {
      status: "deployment-unpinned",
      ok: false,
      observedBytecodeHash: null,
      detail: `Protocol ${protocolId} is not pinned in the registry.`,
    };
  }

  if (protocol.chainId !== chainId) {
    return {
      status: "chain-mismatch",
      ok: false,
      observedBytecodeHash: null,
      detail: `Protocol ${protocolId} is pinned for chain ${protocol.chainId}, not ${chainId}.`,
    };
  }

  if (!protocol.address) {
    return {
      status: "address-missing",
      ok: false,
      observedBytecodeHash: null,
      detail: `Protocol ${protocolId} does not have a pinned Mantle Sepolia deployment address yet.`,
    };
  }

  if (!protocol.expectedBytecodeHash) {
    return {
      status: "deployment-unpinned",
      ok: false,
      observedBytecodeHash: null,
      detail: `Protocol ${protocolId} does not have a pinned runtime bytecode hash yet.`,
    };
  }

  const code = await publicClient.getCode({ address: protocol.address });
  if (!code || code === "0x") {
    return {
      status: "code-missing",
      ok: false,
      observedBytecodeHash: null,
      detail: `No runtime bytecode was found at ${protocol.address}.`,
    };
  }

  const observedBytecodeHash = keccak256(code);
  if (observedBytecodeHash.toLowerCase() !== protocol.expectedBytecodeHash.toLowerCase()) {
    return {
      status: "hash-mismatch",
      ok: false,
      observedBytecodeHash,
      detail: `Runtime bytecode hash mismatch for ${protocolId}.`,
    };
  }

  return {
    status: "validated",
    ok: true,
    observedBytecodeHash,
    detail: `Runtime bytecode for ${protocolId} matches the pinned manifest.`,
  };
};

export const resolveExecutionPlan = async (
  publicClient: PublicClientLike,
  strategyKey: string,
  intent: StrategyIntent,
  context: ScopedExecutionContext,
): Promise<ResolvedExecutionPlan> => {
  const strategy = strategyRegistry[strategyKey];
  if (!strategy) {
    throw new Error(`Unsupported strategyKey: ${strategyKey}`);
  }

  const validationFailures = strategy.validateIntent(intent);
  if (validationFailures.length) {
    throw new Error(validationFailures.join(" "));
  }

  const token = resolveTokenManifest(intent.targetAsset);
  if (!token) {
    throw new Error(`Target asset ${intent.targetAsset} is not pinned in the token registry.`);
  }

  const protocol = protocolRegistry[strategy.defaultProtocolId];
  if (!protocol) {
    throw new Error(`Strategy ${strategy.strategyKey} references unknown protocol ${strategy.defaultProtocolId}.`);
  }

  const action = protocol.actions[strategy.defaultActionId];
  if (!action) {
    throw new Error(`Protocol ${protocol.protocolId} is missing action ${strategy.defaultActionId}.`);
  }

  const normalizedAllowedAssets = unique(normalizeList(context.allowedAssets));
  const normalizedAllowedProtocols = unique(normalizeList(context.allowedProtocols));
  const normalizedTargetAsset = token.symbol.toUpperCase();
  const amountUsd = Number(intent.amountUsd);
  const slippageBps = intent.slippageBps ?? 50;
  const policyChecks: PolicyCheckResult[] = [
    makePolicyCheck(
      "strategy-asset-support",
      strategy.supportedAssets.includes(normalizedTargetAsset),
      `${normalizedTargetAsset} is ${strategy.supportedAssets.includes(normalizedTargetAsset) ? "" : "not "}supported by ${strategy.strategyKey}.`,
    ),
    makePolicyCheck(
      "policy-allowed-assets",
      normalizedAllowedAssets.length === 0 || normalizedAllowedAssets.includes(normalizedTargetAsset),
      normalizedAllowedAssets.length === 0
        ? "User policy does not narrow allowed assets, so registry defaults apply."
        : `${normalizedTargetAsset} ${normalizedAllowedAssets.includes(normalizedTargetAsset) ? "is" : "is not"} present in the user policy allowlist.`,
    ),
    makePolicyCheck(
      "policy-allowed-protocols",
      normalizedAllowedProtocols.length === 0 || normalizedAllowedProtocols.includes(protocol.policyProtocolId.toUpperCase()),
      normalizedAllowedProtocols.length === 0
        ? "User policy does not narrow allowed protocols, so registry defaults apply."
        : `${protocol.policyProtocolId} ${normalizedAllowedProtocols.includes(protocol.policyProtocolId.toUpperCase()) ? "is" : "is not"} present in the user policy allowlist.`,
    ),
    makePolicyCheck(
      "policy-max-action-usd",
      amountUsd <= context.maxActionUsd,
      `Requested ${amountUsd} USD vs max action ${context.maxActionUsd} USD.`,
    ),
    makePolicyCheck(
      "policy-max-automation-usd",
      amountUsd <= context.maxAutomationUsd,
      `Requested ${amountUsd} USD vs max automation ${context.maxAutomationUsd} USD.`,
    ),
    makePolicyCheck(
      "chain-id",
      context.chainId === strategy.chainId,
      `Requested chain ${context.chainId}, strategy chain ${strategy.chainId}.`,
    ),
  ];

  const bytecodeValidation = await validateProtocolDeployment(publicClient, protocol.protocolId, context.chainId);
  policyChecks.push(
    makePolicyCheck(
      "protocol-bytecode-validation",
      bytecodeValidation.ok,
      bytecodeValidation.detail,
    ),
  );

  const validationFailure = policyChecks.find((check) => !check.ok);
  const intentHash = makeIntentHash({
    strategyKey,
    targetAsset: normalizedTargetAsset,
    amountUsd,
    slippageBps,
    ownerEoa: context.ownerEoa.toLowerCase(),
    vaultAddress: context.vaultAddress.toLowerCase(),
    policyVersion: context.policyVersion,
  });
  const resolvedArgs: readonly unknown[] = [
    context.ownerEoa.toLowerCase(),
    context.vaultAddress.toLowerCase(),
    parseUnits(String(amountUsd), 0),
    slippageBps,
    intentHash,
  ];
  const calldata = validationFailure || !protocol.address
    ? null
    : buildUsdYStableAllocationCalldata({
        ownerEoa: context.ownerEoa.toLowerCase() as Address,
        vaultAddress: context.vaultAddress.toLowerCase() as Address,
        amountUsd: parseUnits(String(amountUsd), 0),
        slippageBps,
        intentHash,
      });

  return {
    strategyKey,
    strategyLabel: strategy.label,
    protocolId: protocol.policyProtocolId,
    actionId: action.actionId,
    targetAsset: normalizedTargetAsset,
    targetContract: protocol.address,
    targetSelector: action.selector,
    resolvedArgs,
    calldata,
    executionSummary: validationFailure
      ? `Strategy ${strategy.label} is blocked until all policy and deployment checks pass.`
      : `Strategy ${strategy.label} is ready to dispatch through ${protocol.displayName}.`,
    riskFlags: [
      token.riskClass,
      bytecodeValidation.status,
    ],
    policyChecks,
    bytecodeValidation,
    validationStatus: validationFailure ? "blocked" : "ready",
    validationReason: validationFailure?.detail ?? null,
    intent: {
      targetAsset: normalizedTargetAsset,
      amountUsd,
      slippageBps,
      notes: intent.notes ?? null,
    },
  };
};

export const getApprovedStrategySurface = () => getApprovedExecutionPolicySurface();
