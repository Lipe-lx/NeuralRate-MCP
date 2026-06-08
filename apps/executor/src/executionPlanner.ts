import {
  buildVaultExecutionModuleCalldata,
  CANONICAL_SEPOLIA_USDY_VENUE_REASON,
  buildUsdYStableAllocationCalldata,
  safeModuleStatusAbi,
  getApprovedExecutionPolicySurface,
  makeIntentHash,
  protocolRegistry,
  resolveNativeMntVaultTransfer,
  resolveUsdYVaultApprove,
  resolveUsdYVaultTransfer,
  resolveTokenManifest,
  strategyRegistry,
  type BytecodeValidationResult,
  type PolicyCheckResult,
  type ResolvedExecutionPlan,
  type StrategyIntent,
} from "./executionRegistry.js";
import { keccak256, parseUnits, type Address, type Hex } from "viem";

const ERC20_TRANSFER_SELECTOR = "0xa9059cbb" as Hex;
const ERC20_APPROVE_SELECTOR = "0x095ea7b3" as Hex;
const NATIVE_TRANSFER_SELECTOR = "0x00000000" as Hex;

type ScopedExecutionContext = {
  ownerEoa: string;
  vaultAddress: string;
  chainId: number;
  policyVersion: string;
  maxActionUsd: number;
  maxDailyUsd: number;
  maxAutomationUsd: number;
  maxSlippageBps: number;
  validAfter: number;
  validUntil: number;
  requireSnapshot: boolean;
  allowedAssets: string[];
  allowedProtocols: string[];
  allowedTargets: string[];
  allowedSelectors: string[];
};

type PublicClientLike = {
  getCode(args: { address: Address }): Promise<Hex | undefined>;
  readContract?(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args: readonly unknown[];
  }): Promise<unknown>;
};

const normalizeList = (values: string[]) => values.map((value) => value.trim().toUpperCase()).filter(Boolean);

const unique = (values: string[]) => Array.from(new Set(values));
const isInternalProtocol = (protocolId: string) => protocolId.trim().toLowerCase().startsWith("neuralrate-");

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
  const normalizedAllowedTargets = unique(context.allowedTargets.map((value) => value.trim().toLowerCase()).filter(Boolean));
  const normalizedAllowedSelectors = unique(context.allowedSelectors.map((value) => value.trim().toLowerCase()).filter(Boolean));
  const normalizedTargetAsset = token.symbol.toUpperCase();
  const amountUsd = Number(intent.amountUsd);
  const amountToken = intent.amountToken ?? null;
  const slippageBps = intent.slippageBps ?? 50;
  const snapshotHash = typeof intent.snapshotHash === "string" ? intent.snapshotHash : "";
  const deadlineTs =
    typeof intent.deadline === "string" && intent.deadline.trim()
      ? Math.floor(Date.parse(intent.deadline) / 1000)
      : 0;
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
      isInternalProtocol(protocol.policyProtocolId) ||
        normalizedAllowedProtocols.length === 0 ||
        normalizedAllowedProtocols.includes(protocol.policyProtocolId.toUpperCase()),
      isInternalProtocol(protocol.policyProtocolId)
        ? `${protocol.policyProtocolId} is treated as internal NeuralRate execution infrastructure.`
        : normalizedAllowedProtocols.length === 0
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
      "policy-max-slippage-bps",
      slippageBps <= context.maxSlippageBps,
      `Requested ${slippageBps} bps slippage vs max ${context.maxSlippageBps} bps.`,
    ),
    makePolicyCheck(
      "snapshot-hash-present",
      !context.requireSnapshot || /^0x[a-fA-F0-9]{64}$/.test(snapshotHash),
      !context.requireSnapshot
        ? "Active policy does not require snapshot anchoring for this execution."
        : /^0x[a-fA-F0-9]{64}$/.test(snapshotHash)
        ? `Snapshot hash ${snapshotHash} is present.`
        : "Execution intents must include a 32-byte snapshot hash.",
    ),
    makePolicyCheck(
      "deadline-valid",
      Number.isFinite(deadlineTs) &&
        deadlineTs > Math.floor(Date.now() / 1000) &&
        deadlineTs >= context.validAfter &&
        deadlineTs <= context.validUntil,
      Number.isFinite(deadlineTs) &&
        deadlineTs > Math.floor(Date.now() / 1000) &&
        deadlineTs >= context.validAfter &&
        deadlineTs <= context.validUntil
        ? `Execution deadline ${deadlineTs} is inside the policy validity window.`
        : "Execution intents must include a future ISO-8601 deadline.",
    ),
    makePolicyCheck(
      "chain-id",
      context.chainId === strategy.chainId,
      `Requested chain ${context.chainId}, strategy chain ${strategy.chainId}.`,
    ),
  ];

  if (strategy.strategyKey === "usdy-stable-allocation") {
    policyChecks.push(
      makePolicyCheck(
        "canonical-sepolia-venue-configured",
        false,
        CANONICAL_SEPOLIA_USDY_VENUE_REASON,
      ),
      makePolicyCheck(
        "usdy-token-configured",
        Boolean(token.address),
        token.address
          ? `USDY token address resolved to ${token.address}.`
          : "USDY token address is not configured for real vault execution.",
      ),
    );
  }

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
    amountToken,
    recipientAddress: intent.recipientAddress ?? null,
    slippageBps,
    snapshotHash,
    deadline: intent.deadline ?? null,
    ownerEoa: context.ownerEoa.toLowerCase(),
    vaultAddress: context.vaultAddress.toLowerCase(),
    policyVersion: context.policyVersion,
  });
  let resolvedArgs: readonly unknown[] = [
    context.ownerEoa.toLowerCase(),
    context.vaultAddress.toLowerCase(),
    parseUnits(String(amountUsd), 0),
    slippageBps,
    intentHash,
  ];

  let targetContract = protocol.address;
  let policyTargetContract = protocol.address;
  let targetSelector = action.selector;
  let executionSummary = validationFailure
    ? `Strategy ${strategy.label} is blocked until all policy and deployment checks pass.`
    : `Strategy ${strategy.label} is ready to dispatch through ${protocol.displayName}.`;
  let riskFlags: string[] = [token.riskClass, bytecodeValidation.status];
  let calldata: Hex | null = null;

  if (!validationFailure && protocol.address) {
    if (strategy.strategyKey === "usdy-stable-allocation" || strategy.strategyKey === "usdy-vault-transfer") {
      const moduleEnabled = typeof publicClient.readContract === "function"
        ? Boolean(await publicClient.readContract({
            address: context.vaultAddress as Address,
            abi: safeModuleStatusAbi,
            functionName: "isModuleEnabled",
            args: [protocol.address],
          }))
        : false;

      policyChecks.push(
        makePolicyCheck(
          "safe-module-enabled",
          moduleEnabled,
          moduleEnabled
            ? `Safe ${context.vaultAddress} has enabled the NeuralRate vault module.`
            : `Safe ${context.vaultAddress} has not enabled the NeuralRate vault module.`,
        ),
      );

      const latestFailure = policyChecks.find((check) => !check.ok);
      if (!latestFailure) {
        const routedTransfer = resolveUsdYVaultTransfer({
          ownerEoa: context.ownerEoa.toLowerCase() as Address,
          vaultAddress: context.vaultAddress.toLowerCase() as Address,
          amountUsd,
          recipientAddress: intent.recipientAddress
            ? intent.recipientAddress.toLowerCase() as Address
            : null,
          intentHash,
        });
        targetContract = protocol.address;
        policyTargetContract = routedTransfer.targetContract;
        targetSelector = ERC20_TRANSFER_SELECTOR;
        calldata = buildVaultExecutionModuleCalldata({
          ownerEoa: context.ownerEoa.toLowerCase() as Address,
          vaultAddress: context.vaultAddress.toLowerCase() as Address,
          targetContract: routedTransfer.targetContract,
          value: 0n,
          callData: routedTransfer.tokenCallData,
          intentHash,
          snapshotHash: snapshotHash as Hex,
          slippageBps,
          deadline: BigInt(deadlineTs),
        });
        resolvedArgs = [
          context.ownerEoa.toLowerCase(),
          context.vaultAddress.toLowerCase(),
          routedTransfer.targetContract,
          0n,
          routedTransfer.tokenCallData,
          intentHash,
          snapshotHash,
          BigInt(slippageBps),
          BigInt(deadlineTs),
        ];
        executionSummary =
          strategy.strategyKey === "usdy-stable-allocation"
            ? `Strategy ${strategy.label} is ready to move ${amountUsd} USDY from the Safe to the configured recipient through the enabled NeuralRate module.`
            : `Strategy ${strategy.label} is ready to move ${amountToken ?? amountUsd} USDY from the Safe to ${routedTransfer.recipientAddress}.`;
        riskFlags = [
          token.riskClass,
          bytecodeValidation.status,
          moduleEnabled ? "safe-module-enabled" : "safe-module-disabled",
        ];
      } else {
        executionSummary = `Strategy ${strategy.label} is blocked until the Safe module and vault routing checks pass.`;
      }
    } else if (strategy.strategyKey === "mnt-native-transfer") {
      const moduleEnabled = typeof publicClient.readContract === "function"
        ? Boolean(await publicClient.readContract({
            address: context.vaultAddress as Address,
            abi: safeModuleStatusAbi,
            functionName: "isModuleEnabled",
            args: [protocol.address],
          }))
        : false;

      policyChecks.push(
        makePolicyCheck(
          "safe-module-enabled",
          moduleEnabled,
          moduleEnabled
            ? `Safe ${context.vaultAddress} has enabled the NeuralRate vault module.`
            : `Safe ${context.vaultAddress} has not enabled the NeuralRate vault module.`,
        ),
      );

      const latestFailure = policyChecks.find((check) => !check.ok);
      if (!latestFailure) {
        const routedTransfer = resolveNativeMntVaultTransfer({
          ownerEoa: context.ownerEoa.toLowerCase() as Address,
          recipientAddress: intent.recipientAddress
            ? intent.recipientAddress.toLowerCase() as Address
            : null,
          amountUsd,
          amountToken,
        });
        targetContract = protocol.address;
        policyTargetContract = routedTransfer.targetContract;
        targetSelector = NATIVE_TRANSFER_SELECTOR;
        calldata = buildVaultExecutionModuleCalldata({
          ownerEoa: context.ownerEoa.toLowerCase() as Address,
          vaultAddress: context.vaultAddress.toLowerCase() as Address,
          targetContract: routedTransfer.targetContract,
          value: routedTransfer.value,
          callData: routedTransfer.callData,
          intentHash,
          snapshotHash: snapshotHash as Hex,
          slippageBps,
          deadline: BigInt(deadlineTs),
        });
        resolvedArgs = [
          context.ownerEoa.toLowerCase(),
          context.vaultAddress.toLowerCase(),
          routedTransfer.targetContract,
          routedTransfer.value,
          routedTransfer.callData,
          intentHash,
          snapshotHash,
          BigInt(slippageBps),
          BigInt(deadlineTs),
        ];
        executionSummary = `Strategy ${strategy.label} is ready to move ${amountToken ?? amountUsd} MNT from the Safe to ${routedTransfer.recipientAddress}.`;
        riskFlags = [
          token.riskClass,
          bytecodeValidation.status,
          moduleEnabled ? "safe-module-enabled" : "safe-module-disabled",
        ];
      } else {
        executionSummary = `Strategy ${strategy.label} is blocked until the Safe module checks pass.`;
      }
    } else if (strategy.strategyKey === "usdy-approve-spender") {
      const moduleEnabled = typeof publicClient.readContract === "function"
        ? Boolean(await publicClient.readContract({
            address: context.vaultAddress as Address,
            abi: safeModuleStatusAbi,
            functionName: "isModuleEnabled",
            args: [protocol.address],
          }))
        : false;

      policyChecks.push(
        makePolicyCheck(
          "safe-module-enabled",
          moduleEnabled,
          moduleEnabled
            ? `Safe ${context.vaultAddress} has enabled the NeuralRate vault module.`
            : `Safe ${context.vaultAddress} has not enabled the NeuralRate vault module.`,
        ),
      );

      const latestFailure = policyChecks.find((check) => !check.ok);
      if (!latestFailure) {
        if (!intent.spenderAddress) {
          throw new Error("spenderAddress is required for approve strategies.");
        }
        const approval = resolveUsdYVaultApprove({
          spenderAddress: intent.spenderAddress.toLowerCase() as Address,
          amountUsd,
          amountToken,
        });
        targetContract = protocol.address;
        policyTargetContract = approval.targetContract;
        targetSelector = ERC20_APPROVE_SELECTOR;
        calldata = buildVaultExecutionModuleCalldata({
          ownerEoa: context.ownerEoa.toLowerCase() as Address,
          vaultAddress: context.vaultAddress.toLowerCase() as Address,
          targetContract: approval.targetContract,
          value: 0n,
          callData: approval.tokenCallData,
          intentHash,
          snapshotHash: snapshotHash as Hex,
          slippageBps,
          deadline: BigInt(deadlineTs),
        });
        resolvedArgs = [
          context.ownerEoa.toLowerCase(),
          context.vaultAddress.toLowerCase(),
          approval.targetContract,
          0n,
          approval.tokenCallData,
          intentHash,
          snapshotHash,
          BigInt(slippageBps),
          BigInt(deadlineTs),
        ];
        executionSummary = `Strategy ${strategy.label} is ready to approve ${approval.spenderAddress} for ${amountToken ?? amountUsd} USDY through the enabled NeuralRate module.`;
        riskFlags = [
          token.riskClass,
          bytecodeValidation.status,
          moduleEnabled ? "safe-module-enabled" : "safe-module-disabled",
          "erc20-approve",
        ];
      } else {
        executionSummary = `Strategy ${strategy.label} is blocked until the Safe module checks pass.`;
      }
    } else {
      calldata = buildUsdYStableAllocationCalldata({
        ownerEoa: context.ownerEoa.toLowerCase() as Address,
        vaultAddress: context.vaultAddress.toLowerCase() as Address,
        amountUsd: parseUnits(String(amountUsd), 0),
        slippageBps,
        intentHash,
      });
    }
  }

  if (policyTargetContract && targetSelector) {
    policyChecks.push(
      makePolicyCheck(
        "policy-allowed-targets",
        normalizedAllowedTargets.length === 0 || normalizedAllowedTargets.includes(policyTargetContract.toLowerCase()),
        normalizedAllowedTargets.length === 0
          ? "Active on-chain policy does not narrow allowed target contracts."
          : `${policyTargetContract.toLowerCase()} ${normalizedAllowedTargets.includes(policyTargetContract.toLowerCase()) ? "is" : "is not"} present in the on-chain target allowlist.`,
      ),
      makePolicyCheck(
        "policy-allowed-selectors",
        normalizedAllowedSelectors.length === 0 || normalizedAllowedSelectors.includes(targetSelector.toLowerCase()),
        normalizedAllowedSelectors.length === 0
          ? "Active on-chain policy does not narrow allowed selectors."
          : `${targetSelector.toLowerCase()} ${normalizedAllowedSelectors.includes(targetSelector.toLowerCase()) ? "is" : "is not"} present in the on-chain selector allowlist.`,
      ),
    );
  }

  const effectiveFinalValidationFailure = policyChecks.find((check) => !check.ok);

  return {
    strategyKey,
    strategyLabel: strategy.label,
    protocolId: protocol.policyProtocolId,
    actionId: action.actionId,
    targetAsset: normalizedTargetAsset,
    targetContract,
    targetSelector,
    resolvedArgs,
    calldata,
    executionSummary,
    riskFlags,
    policyChecks,
    bytecodeValidation,
    validationStatus: effectiveFinalValidationFailure ? "blocked" : "ready",
    validationReason: effectiveFinalValidationFailure?.detail ?? null,
    intent: {
      targetAsset: normalizedTargetAsset,
      amountUsd,
      amountToken,
      recipientAddress: intent.recipientAddress ?? null,
      slippageBps,
      protocolHint: intent.protocolHint ?? null,
      positionId: intent.positionId ?? null,
      spenderAddress: intent.spenderAddress ?? null,
      notes: intent.notes ?? null,
      snapshotHash: snapshotHash || null,
      snapshotCid: intent.snapshotCid ?? null,
      deadline: intent.deadline ?? null,
    },
  };
};

export const getApprovedStrategySurface = () => getApprovedExecutionPolicySurface();
