import { isAddress } from "viem";
import { AutomationStore } from "./automation";
import type { ScopedAutomationAccess } from "./automationControl";
import type { RuntimeEnv } from "./onchainState";
import {
  loadScopedStateCatalogSnapshot,
  type OpenPositionSnapshot,
  type StateCatalogSnapshot,
} from "./stateCatalog";

type GovernedExecutionActionName =
  | "transfer_asset"
  | "open_position"
  | "increase_position"
  | "decrease_position"
  | "close_position"
  | "claim_rewards"
  | "sweep_idle_balance"
  | "rebalance_to_target"
  | "rotate_strategy"
  | "approve_strategy_spender";

type CommonGovernedArgs = {
  amountUsd?: number;
  amountToken?: number;
  snapshotHash?: string;
  snapshotCid?: string;
  deadline?: string;
  notes?: string;
};

type TransferAssetArgs = CommonGovernedArgs & {
  asset: string;
  recipientAddress?: string;
};

type OpenPositionArgs = CommonGovernedArgs & {
  asset: string;
  protocolHint?: string;
  slippageBps?: number;
};

type IncreasePositionArgs = CommonGovernedArgs & {
  asset: string;
  positionId?: string;
  protocolHint?: string;
  slippageBps?: number;
};

type DecreasePositionArgs = CommonGovernedArgs & {
  asset?: string;
  positionId?: string;
  recipientAddress?: string;
  protocolHint?: string;
  slippageBps?: number;
};

type ClosePositionArgs = {
  asset?: string;
  positionId?: string;
  recipientAddress?: string;
  protocolHint?: string;
  snapshotHash?: string;
  snapshotCid?: string;
  deadline?: string;
  notes?: string;
};

type ClaimRewardsArgs = {
  asset?: string;
  positionId?: string;
  protocolHint?: string;
  deadline?: string;
  notes?: string;
};

type SweepIdleBalanceArgs = CommonGovernedArgs & {
  asset?: string;
  recipientAddress?: string;
};

type RebalanceToTargetArgs = CommonGovernedArgs & {
  targetAsset: string;
  protocolHint?: string;
  slippageBps?: number;
};

type RotateStrategyArgs = CommonGovernedArgs & {
  fromPositionId?: string;
  toAsset: string;
  protocolHint?: string;
  slippageBps?: number;
};

type ApproveStrategySpenderArgs = CommonGovernedArgs & {
  asset: string;
  spenderAddress: string;
};

type GovernedExecutionActionArgs =
  | TransferAssetArgs
  | OpenPositionArgs
  | IncreasePositionArgs
  | DecreasePositionArgs
  | ClosePositionArgs
  | ClaimRewardsArgs
  | SweepIdleBalanceArgs
  | RebalanceToTargetArgs
  | RotateStrategyArgs
  | ApproveStrategySpenderArgs;

export type GovernedExecutionActionPlan = {
  action: GovernedExecutionActionName;
  supported: boolean;
  status: "ready" | "blocked" | "noop";
  summary: string;
  blockedReasons: string[];
  warnings: string[];
  strategyKey: string | null;
  intent: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  readiness: StateCatalogSnapshot["readiness"];
  policySurface: StateCatalogSnapshot["policySurface"];
  positions: OpenPositionSnapshot[];
};

const normalizeText = (value: string | undefined | null) => value?.trim() ?? "";
const normalizeUpper = (value: string | undefined | null) => normalizeText(value).toUpperCase();
const normalizeLower = (value: string | undefined | null) => normalizeText(value).toLowerCase();

const supportedUsdYProtocolHints = new Set([
  "",
  "usdy-stable-allocation",
  "neuralrate-vault-module",
  "neuralrate-vault-module-v1",
  "neuralrate-usdy-adapter",
  "neuralrate-usdy-adapter-v1",
]);

const isFinitePositive = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0;

const resolveDefaultDeadline = (snapshot: StateCatalogSnapshot) => {
  const now = Date.now();
  const thirtyMinutes = now + 30 * 60 * 1000;
  const policyValidUntil = snapshot.policySurface.validity.validUntil
    ? Date.parse(snapshot.policySurface.validity.validUntil)
    : Number.NaN;

  if (Number.isFinite(policyValidUntil)) {
    const capped = Math.min(thirtyMinutes, policyValidUntil - 60_000);
    if (capped > now + 60_000) {
      return new Date(capped).toISOString();
    }
  }

  return new Date(thirtyMinutes).toISOString();
};

const findPosition = (positions: OpenPositionSnapshot[], positionId?: string) =>
  positionId ? positions.find((position) => position.positionId === positionId) ?? null : null;

const pushIfMissing = (target: string[], message: string) => {
  if (!target.includes(message)) {
    target.push(message);
  }
};

const enforceCommonPolicyChecks = (
  snapshot: StateCatalogSnapshot,
  blockedReasons: string[],
  args: CommonGovernedArgs,
  asset: string,
  protocolIds: string[],
  slippageBps?: number | null
) => {
  const { policySurface } = snapshot;
  const amountUsd = args.amountUsd;
  const numericAmountUsd =
    typeof amountUsd === "number" && Number.isFinite(amountUsd) && amountUsd > 0
      ? amountUsd
      : null;

  if (policySurface.source === "none") {
    pushIfMissing(blockedReasons, "No draft or on-chain policy surface is available for this vault yet.");
  }
  if (policySurface.source === "onchain" && !policySurface.validity.isActiveNow) {
    pushIfMissing(blockedReasons, "The active on-chain policy is outside its validity window.");
  }
  if (policySurface.requireSnapshot && !normalizeText(args.snapshotHash)) {
    pushIfMissing(blockedReasons, "The active policy requires snapshotHash for execution intents.");
  }
  if (numericAmountUsd !== null) {
    if (policySurface.limits.perUseUsd !== null && numericAmountUsd > policySurface.limits.perUseUsd) {
      pushIfMissing(blockedReasons, `Requested ${numericAmountUsd} USD exceeds the per-use policy limit of ${policySurface.limits.perUseUsd} USD.`);
    }
    if (policySurface.remainingBudget.dailyUsd !== null && numericAmountUsd > policySurface.remainingBudget.dailyUsd) {
      pushIfMissing(blockedReasons, `Requested ${numericAmountUsd} USD exceeds the remaining daily budget of ${policySurface.remainingBudget.dailyUsd} USD.`);
    }
    if (policySurface.remainingBudget.totalUsd !== null && numericAmountUsd > policySurface.remainingBudget.totalUsd) {
      pushIfMissing(blockedReasons, `Requested ${numericAmountUsd} USD exceeds the remaining total automation budget of ${policySurface.remainingBudget.totalUsd} USD.`);
    }
  }
  if (policySurface.allowlists.assets.length > 0 && !policySurface.allowlists.assets.includes(asset)) {
    pushIfMissing(blockedReasons, `${asset} is not present in the active asset allowlist.`);
  }
  if (
    policySurface.allowlists.protocols.length > 0 &&
    !protocolIds.some((protocolId) => policySurface.allowlists.protocols.includes(protocolId.toUpperCase()))
  ) {
    pushIfMissing(blockedReasons, `None of the candidate protocols for this action are present in the active protocol allowlist.`);
  }
  if (
    slippageBps !== null &&
    slippageBps !== undefined &&
    policySurface.limits.maxSlippageBps !== null &&
    slippageBps > policySurface.limits.maxSlippageBps
  ) {
    pushIfMissing(blockedReasons, `Requested ${slippageBps} bps exceeds the policy slippage cap of ${policySurface.limits.maxSlippageBps} bps.`);
  }
};

const makeBlockedPlan = (
  snapshot: StateCatalogSnapshot,
  action: GovernedExecutionActionName,
  blockedReasons: string[],
  summary: string,
  payload: Record<string, unknown> = {}
): GovernedExecutionActionPlan => ({
  action,
  supported: false,
  status: "blocked",
  summary,
  blockedReasons,
  warnings: snapshot.readiness.warnings,
  strategyKey: null,
  intent: null,
  payload,
  readiness: snapshot.readiness,
  policySurface: snapshot.policySurface,
  positions: snapshot.positions,
});

const makeNoopPlan = (
  snapshot: StateCatalogSnapshot,
  action: GovernedExecutionActionName,
  summary: string,
  payload: Record<string, unknown> = {}
): GovernedExecutionActionPlan => ({
  action,
  supported: true,
  status: "noop",
  summary,
  blockedReasons: [],
  warnings: snapshot.readiness.warnings,
  strategyKey: null,
  intent: null,
  payload,
  readiness: snapshot.readiness,
  policySurface: snapshot.policySurface,
  positions: snapshot.positions,
});

const makeReadyPlan = (
  snapshot: StateCatalogSnapshot,
  action: GovernedExecutionActionName,
  summary: string,
  strategyKey: string,
  intent: Record<string, unknown>,
  payload: Record<string, unknown> = {}
): GovernedExecutionActionPlan => ({
  action,
  supported: true,
  status: "ready",
  summary,
  blockedReasons: [],
  warnings: snapshot.readiness.warnings,
  strategyKey,
  intent,
  payload,
  readiness: snapshot.readiness,
  policySurface: snapshot.policySurface,
  positions: snapshot.positions,
});

export function planGovernedExecutionActionFromSnapshot(
  snapshot: StateCatalogSnapshot,
  access: ScopedAutomationAccess,
  action: GovernedExecutionActionName,
  args: GovernedExecutionActionArgs
): GovernedExecutionActionPlan {
  const readinessBlocks = [...snapshot.readiness.blockedReasons];
  const defaultDeadline = resolveDefaultDeadline(snapshot);
  const resolveAssetPosition = (asset?: string, positionId?: string) => {
    const byId = findPosition(snapshot.positions, positionId);
    if (byId) {
      return byId;
    }
    const normalizedAsset = normalizeUpper(asset);
    return normalizedAsset
      ? snapshot.positions.find((position) => normalizeUpper(position.asset) === normalizedAsset) ?? null
      : null;
  };

  if (action === "transfer_asset") {
    const typedArgs = args as TransferAssetArgs;
    const asset = normalizeUpper(typedArgs.asset);
    const recipientAddress = normalizeLower(typedArgs.recipientAddress) || access.ownerEoa;
    const blockedReasons = [...readinessBlocks];

    if (asset !== "MNT") {
      pushIfMissing(blockedReasons, "transfer_asset currently supports only MNT through the pinned vault-module transfer action.");
    }
    if (!isFinitePositive(typedArgs.amountUsd)) {
      pushIfMissing(blockedReasons, "amountUsd must be a positive number.");
    }
    if (typedArgs.amountToken !== undefined && !isFinitePositive(typedArgs.amountToken)) {
      pushIfMissing(blockedReasons, "amountToken must be a positive number when provided.");
    }
    if (!isAddress(recipientAddress)) {
      pushIfMissing(blockedReasons, "recipientAddress must be a valid EVM address.");
    }
    enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "MNT", ["NEURALRATE-VAULT-MODULE"], 0);

    if (blockedReasons.length > 0) {
      return makeBlockedPlan(
        snapshot,
        action,
        blockedReasons,
        "Transfer is blocked until vault readiness, policy checks, and recipient validation all pass.",
        {
          recipientAddress,
          requestedAsset: asset,
        }
      );
    }

    return makeReadyPlan(
      snapshot,
      action,
      `Transfer ${typedArgs.amountToken ?? typedArgs.amountUsd} MNT from the vault to ${recipientAddress}.`,
      "mnt-native-transfer",
      {
        targetAsset: "MNT",
        amountUsd: typedArgs.amountUsd,
        amountToken: typedArgs.amountToken ?? null,
        recipientAddress,
        slippageBps: 0,
        snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
        snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
        deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
        notes: typedArgs.notes ?? null,
      },
      {
        action,
        recipientAddress,
      }
    );
  }

  if (action === "open_position" || action === "increase_position") {
    const typedArgs = args as OpenPositionArgs & { positionId?: string };
    const asset = normalizeUpper(typedArgs.asset);
    const protocolHint = normalizeLower(typedArgs.protocolHint);
    const blockedReasons = [...readinessBlocks];
    const candidateProtocols = ["NEURALRATE-VAULT-MODULE"];

    if (asset !== "USDY") {
      pushIfMissing(blockedReasons, `${action} currently supports only USDY allocation through the pinned vault-module strategy.`);
    }
    if (!supportedUsdYProtocolHints.has(protocolHint)) {
      pushIfMissing(blockedReasons, `${typedArgs.protocolHint} is not a supported protocol hint for the current USDY allocation path.`);
    }
    if (!isFinitePositive(typedArgs.amountUsd)) {
      pushIfMissing(blockedReasons, "amountUsd must be a positive number.");
    }
    if (
      action === "increase_position" &&
      typedArgs.positionId &&
      !findPosition(snapshot.positions, typedArgs.positionId)
    ) {
      pushIfMissing(blockedReasons, `positionId ${typedArgs.positionId} is not present in the current scoped position surface.`);
    }
    enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "USDY", candidateProtocols, typedArgs.slippageBps ?? 50);

    if (blockedReasons.length > 0) {
      return makeBlockedPlan(
        snapshot,
        action,
        blockedReasons,
        "Position deployment is blocked until readiness, policy, and protocol checks pass.",
        {
          action,
          protocolHint: typedArgs.protocolHint ?? null,
          positionId: typedArgs.positionId ?? null,
        }
      );
    }

    return makeReadyPlan(
      snapshot,
      action,
      `${action === "open_position" ? "Open" : "Increase"} a USDY position through the pinned vault-module execution path.`,
      "usdy-stable-allocation",
      {
        targetAsset: "USDY",
        amountUsd: typedArgs.amountUsd,
        slippageBps: typedArgs.slippageBps ?? Math.min(snapshot.policySurface.limits.maxSlippageBps ?? 50, 50),
        protocolHint: protocolHint || null,
        positionId: typedArgs.positionId ?? null,
        snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
        snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
        deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
        notes: typedArgs.notes ?? null,
      },
      {
        action,
        positionId: typedArgs.positionId ?? null,
      }
    );
  }

  if (action === "sweep_idle_balance") {
    const typedArgs = args as SweepIdleBalanceArgs;
    const asset = normalizeUpper(typedArgs.asset || "MNT");
    const recipientAddress = normalizeLower(typedArgs.recipientAddress) || access.ownerEoa;
    const blockedReasons = [...readinessBlocks];

    if (asset !== "MNT") {
      pushIfMissing(blockedReasons, "sweep_idle_balance currently supports only native MNT.");
    }
    if (!isFinitePositive(typedArgs.amountUsd)) {
      pushIfMissing(blockedReasons, "amountUsd must be a positive number.");
    }
    if (!isAddress(recipientAddress)) {
      pushIfMissing(blockedReasons, "recipientAddress must be a valid EVM address.");
    }
    enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "MNT", ["NEURALRATE-VAULT-MODULE"], 0);

    if (blockedReasons.length > 0) {
      return makeBlockedPlan(
        snapshot,
        action,
        blockedReasons,
        "Idle balance sweep is blocked until readiness, policy, and recipient checks pass.",
        {
          action,
          recipientAddress,
          requestedAsset: asset,
        }
      );
    }

    return makeReadyPlan(
      snapshot,
      action,
      `Sweep idle ${typedArgs.amountToken ?? typedArgs.amountUsd} MNT to ${recipientAddress}.`,
      "mnt-native-transfer",
      {
        targetAsset: "MNT",
        amountUsd: typedArgs.amountUsd,
        amountToken: typedArgs.amountToken ?? null,
        recipientAddress,
        slippageBps: 0,
        snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
        snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
        deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
        notes: typedArgs.notes ?? null,
      },
      {
        action,
        recipientAddress,
      }
    );
  }

  if (action === "rebalance_to_target") {
    const typedArgs = args as RebalanceToTargetArgs;
    const targetAsset = normalizeUpper(typedArgs.targetAsset);
    const blockedReasons = [...readinessBlocks];
    if (targetAsset !== "USDY") {
      pushIfMissing(blockedReasons, "rebalance_to_target currently supports only one-sided rebalance into USDY.");
    }
    if (!supportedUsdYProtocolHints.has(normalizeLower(typedArgs.protocolHint))) {
      pushIfMissing(blockedReasons, `${typedArgs.protocolHint} is not a supported protocol hint for the current USDY rebalance path.`);
    }
    if (!isFinitePositive(typedArgs.amountUsd)) {
      pushIfMissing(blockedReasons, "amountUsd must be a positive number.");
    }
    enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "USDY", ["NEURALRATE-VAULT-MODULE"], typedArgs.slippageBps ?? 50);

    if (blockedReasons.length > 0) {
      return makeBlockedPlan(
        snapshot,
        action,
        blockedReasons,
        "Rebalance is blocked until readiness, policy, and protocol checks pass.",
        {
          action,
          targetAsset,
        }
      );
    }

    return makeReadyPlan(
      snapshot,
      action,
      "Rebalance idle vault capacity into the supported USDY target allocation path.",
      "usdy-stable-allocation",
      {
        targetAsset: "USDY",
        amountUsd: typedArgs.amountUsd,
        slippageBps: typedArgs.slippageBps ?? Math.min(snapshot.policySurface.limits.maxSlippageBps ?? 50, 50),
        protocolHint: normalizeLower(typedArgs.protocolHint) || null,
        snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
        snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
        deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
        notes: typedArgs.notes ?? null,
      },
      {
        action,
      }
    );
  }

  if (action === "decrease_position") {
    const typedArgs = args as DecreasePositionArgs;
    const position = resolveAssetPosition(typedArgs.asset, typedArgs.positionId);
    const blockedReasons = [...readinessBlocks];
    if (!position) {
      pushIfMissing(blockedReasons, "A wallet-held position matching positionId or asset is required for decrease_position.");
    }
    if (!isFinitePositive(typedArgs.amountUsd)) {
      pushIfMissing(blockedReasons, "amountUsd must be a positive number.");
    }
    const recipientAddress = normalizeLower(typedArgs.recipientAddress) || access.ownerEoa;
    if (!isAddress(recipientAddress)) {
      pushIfMissing(blockedReasons, "recipientAddress must be a valid EVM address.");
    }
    const resolvedAsset = normalizeUpper(position?.asset ?? typedArgs.asset ?? "");
    const amountToken = typedArgs.amountToken ?? (isFinitePositive(typedArgs.amountUsd) ? typedArgs.amountUsd : undefined);
    if (resolvedAsset === "MNT") {
      enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "MNT", ["NEURALRATE-VAULT-MODULE"], 0);
    } else if (resolvedAsset === "USDY") {
      enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "USDY", ["NEURALRATE-VAULT-MODULE"], 0);
    } else {
      pushIfMissing(blockedReasons, "decrease_position currently supports only wallet-held MNT or USDY positions.");
    }

    if (blockedReasons.length > 0) {
      return makeBlockedPlan(
        snapshot,
        action,
        blockedReasons,
        "Position reduction is blocked until the wallet-held position, policy, and recipient checks pass.",
        {
          action,
          positionId: typedArgs.positionId ?? null,
          asset: typedArgs.asset ?? null,
          recipientAddress,
        }
      );
    }

    if (resolvedAsset === "MNT") {
      return makeReadyPlan(
        snapshot,
        action,
        `Reduce a wallet-held MNT position by transferring ${amountToken ?? typedArgs.amountUsd} MNT to ${recipientAddress}.`,
        "mnt-native-transfer",
        {
          targetAsset: "MNT",
          amountUsd: typedArgs.amountUsd,
          amountToken: amountToken ?? null,
          recipientAddress,
          slippageBps: 0,
          positionId: position?.positionId ?? null,
          snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
          snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
          deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
          notes: typedArgs.notes ?? null,
        },
        {
          action,
          positionId: position?.positionId ?? null,
        }
      );
    }

    return makeReadyPlan(
      snapshot,
      action,
      `Reduce a wallet-held USDY position by transferring ${amountToken ?? typedArgs.amountUsd} USDY to ${recipientAddress}.`,
      "usdy-vault-transfer",
      {
        targetAsset: "USDY",
        amountUsd: typedArgs.amountUsd,
        amountToken: amountToken ?? null,
        recipientAddress,
        slippageBps: 0,
        positionId: position?.positionId ?? null,
        snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
        snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
        deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
        notes: typedArgs.notes ?? null,
      },
      {
        action,
        positionId: position?.positionId ?? null,
      }
    );
  }

  if (action === "close_position") {
    const typedArgs = args as ClosePositionArgs;
    const position = resolveAssetPosition(typedArgs.asset, typedArgs.positionId);
    const blockedReasons = [...readinessBlocks];
    if (!position) {
      pushIfMissing(blockedReasons, "A wallet-held position matching positionId or asset is required for close_position.");
    }
    const recipientAddress = normalizeLower(typedArgs.recipientAddress) || access.ownerEoa;
    if (!isAddress(recipientAddress)) {
      pushIfMissing(blockedReasons, "recipientAddress must be a valid EVM address.");
    }
    const resolvedAsset = normalizeUpper(position?.asset ?? typedArgs.asset ?? "");
    const derivedAmount = position ? Number.parseFloat(position.amount.formatted) : Number.NaN;
    if (!Number.isFinite(derivedAmount) || derivedAmount <= 0) {
      pushIfMissing(blockedReasons, "The selected position does not expose a closable positive amount.");
    }
    const baseArgs: CommonGovernedArgs = {
      amountUsd: Number.isFinite(derivedAmount) ? derivedAmount : undefined,
      amountToken: Number.isFinite(derivedAmount) ? derivedAmount : undefined,
      snapshotHash: typedArgs.snapshotHash,
      snapshotCid: typedArgs.snapshotCid,
      deadline: typedArgs.deadline,
      notes: typedArgs.notes,
    };
    if (resolvedAsset === "MNT") {
      enforceCommonPolicyChecks(snapshot, blockedReasons, baseArgs, "MNT", ["NEURALRATE-VAULT-MODULE"], 0);
    } else if (resolvedAsset === "USDY") {
      enforceCommonPolicyChecks(snapshot, blockedReasons, baseArgs, "USDY", ["NEURALRATE-VAULT-MODULE"], 0);
    } else {
      pushIfMissing(blockedReasons, "close_position currently supports only wallet-held MNT or USDY positions.");
    }

    if (blockedReasons.length > 0) {
      return makeBlockedPlan(
        snapshot,
        action,
        blockedReasons,
        "Position close is blocked until the wallet-held position, policy, and recipient checks pass.",
        {
          action,
          positionId: typedArgs.positionId ?? null,
          asset: typedArgs.asset ?? null,
          recipientAddress,
        }
      );
    }

    if (resolvedAsset === "MNT") {
      return makeReadyPlan(
        snapshot,
        action,
        `Close a wallet-held MNT position by transferring the full balance to ${recipientAddress}.`,
        "mnt-native-transfer",
        {
          targetAsset: "MNT",
          amountUsd: derivedAmount,
          amountToken: derivedAmount,
          recipientAddress,
          slippageBps: 0,
          positionId: position?.positionId ?? null,
          snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
          snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
          deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
          notes: typedArgs.notes ?? null,
        },
        {
          action,
          positionId: position?.positionId ?? null,
        }
      );
    }

    return makeReadyPlan(
      snapshot,
      action,
      `Close a wallet-held USDY position by transferring the full balance to ${recipientAddress}.`,
      "usdy-vault-transfer",
      {
        targetAsset: "USDY",
        amountUsd: derivedAmount,
        amountToken: derivedAmount,
        recipientAddress,
        slippageBps: 0,
        positionId: position?.positionId ?? null,
        snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
        snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
        deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
        notes: typedArgs.notes ?? null,
      },
      {
        action,
        positionId: position?.positionId ?? null,
      }
    );
  }

  if (action === "claim_rewards") {
    const typedArgs = args as ClaimRewardsArgs;
    const position = resolveAssetPosition(typedArgs.asset, typedArgs.positionId);
    if (!position) {
      return makeBlockedPlan(
        snapshot,
        action,
        [
          ...readinessBlocks,
          "A position matching positionId or asset is required for claim_rewards.",
        ],
        "Reward claiming is blocked because the selected position could not be resolved.",
        {
          action,
          positionId: typedArgs.positionId ?? null,
          asset: typedArgs.asset ?? null,
        }
      );
    }

    const rewardCount = Array.isArray(position.rewards) ? position.rewards.length : 0;
    if (rewardCount === 0) {
      return makeNoopPlan(
        snapshot,
        action,
        `Position ${position.positionId} has no claimable rewards on the current wallet-held surface.`,
        {
          action,
          positionId: position.positionId,
          asset: position.asset,
        }
      );
    }

    return makeBlockedPlan(
      snapshot,
      action,
      [
        ...readinessBlocks,
        "Claimable rewards are present, but no pinned rewards-claim adapter is available yet for this protocol.",
      ],
      "Reward claiming still requires a pinned protocol adapter for non-wallet rewards surfaces.",
      {
        action,
        positionId: position.positionId,
        asset: position.asset,
      }
    );
  }

  if (action === "rotate_strategy") {
    const typedArgs = args as RotateStrategyArgs;
    const targetAsset = normalizeUpper(typedArgs.toAsset);
    const sourcePosition = findPosition(snapshot.positions, typedArgs.fromPositionId);
    if (sourcePosition && normalizeUpper(sourcePosition.asset) === targetAsset) {
      return makeNoopPlan(
        snapshot,
        action,
        `Position ${sourcePosition.positionId} is already denominated in ${targetAsset}; no rotation is required.`,
        {
          action,
          fromPositionId: sourcePosition.positionId,
          toAsset: targetAsset,
        }
      );
    }

    if (targetAsset === "USDY") {
      const aliasPlan = planGovernedExecutionActionFromSnapshot(
        snapshot,
        access,
        "rebalance_to_target",
        {
          targetAsset: "USDY",
          amountUsd: typedArgs.amountUsd,
          amountToken: typedArgs.amountToken,
          protocolHint: typedArgs.protocolHint,
          slippageBps: typedArgs.slippageBps,
          snapshotHash: typedArgs.snapshotHash,
          snapshotCid: typedArgs.snapshotCid,
          deadline: typedArgs.deadline,
          notes: typedArgs.notes,
        }
      );
      return {
        ...aliasPlan,
        action,
        summary:
          aliasPlan.status === "ready"
            ? "Rotate strategy into the supported USDY target path."
            : aliasPlan.summary,
        payload: {
          ...aliasPlan.payload,
          action,
          fromPositionId: typedArgs.fromPositionId ?? null,
          toAsset: targetAsset,
        },
      };
    }

    return makeBlockedPlan(
      snapshot,
      action,
      [
        ...readinessBlocks,
        "rotate_strategy currently supports only the pinned USDY target path, and does not perform asset conversion or unwind flows yet.",
      ],
      "Strategy rotation is blocked because the requested target requires an unwind or conversion path that is not available in the current runtime.",
      {
        action,
        fromPositionId: typedArgs.fromPositionId ?? null,
        toAsset: targetAsset,
      }
    );
  }

  const typedArgs = args as ApproveStrategySpenderArgs;
  const blockedReasons = [...readinessBlocks];
  const asset = normalizeUpper(typedArgs.asset);
  const spenderAddress = normalizeLower(typedArgs.spenderAddress);
  if (asset !== "USDY") {
    pushIfMissing(blockedReasons, "approve_strategy_spender currently supports only USDY.");
  }
  if (!isFinitePositive(typedArgs.amountUsd)) {
    pushIfMissing(blockedReasons, "amountUsd must be a positive number.");
  }
  if (typedArgs.amountToken !== undefined && !isFinitePositive(typedArgs.amountToken)) {
    pushIfMissing(blockedReasons, "amountToken must be a positive number when provided.");
  }
  if (!isAddress(spenderAddress)) {
    pushIfMissing(blockedReasons, "spenderAddress must be a valid EVM address.");
  }
  enforceCommonPolicyChecks(snapshot, blockedReasons, typedArgs, "USDY", ["NEURALRATE-VAULT-MODULE"], 0);

  if (blockedReasons.length > 0) {
    return makeBlockedPlan(
      snapshot,
      "approve_strategy_spender",
      blockedReasons,
      "Allowance approval is blocked until asset, spender, and policy checks pass.",
      {
        action: "approve_strategy_spender",
        asset: typedArgs.asset,
        spenderAddress: typedArgs.spenderAddress,
      }
    );
  }

  return makeReadyPlan(
    snapshot,
    "approve_strategy_spender",
    `Approve ${spenderAddress} to spend ${typedArgs.amountToken ?? typedArgs.amountUsd} USDY through the pinned vault-module path.`,
    "usdy-approve-spender",
    {
      targetAsset: "USDY",
      amountUsd: typedArgs.amountUsd,
      amountToken: typedArgs.amountToken ?? null,
      spenderAddress,
      slippageBps: 0,
      snapshotHash: normalizeText(typedArgs.snapshotHash) || null,
      snapshotCid: normalizeText(typedArgs.snapshotCid) || null,
      deadline: normalizeText(typedArgs.deadline) || defaultDeadline,
      notes: typedArgs.notes ?? null,
    },
    {
      action: "approve_strategy_spender",
    }
  );
}

export async function planGovernedExecutionAction(
  automation: AutomationStore,
  env: RuntimeEnv,
  access: ScopedAutomationAccess,
  action: GovernedExecutionActionName,
  args: GovernedExecutionActionArgs
) {
  const snapshot = await loadScopedStateCatalogSnapshot(automation, env, access.ownerEoa);
  return planGovernedExecutionActionFromSnapshot(snapshot, access, action, args);
}
