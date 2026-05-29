import { getApprovedStrategySurface } from "./executionPlanner.js";

const parseRuntimeChainId = () => {
  const raw =
    typeof process !== "undefined" && process.env
      ? Number.parseInt(process.env.NEURALRATE_CHAIN_ID || "", 10)
      : Number.NaN;
  return Number.isFinite(raw) ? raw : 5003;
};

export type PolicyRequest = {
  ownerEoa: string;
  vaultAddress: string;
  vaultId?: string | null;
  userId?: string | null;
  validAfter?: string | null;
  validUntil?: string | null;
  spendToken?: string | null;
  spendLimitPerUse?: string | null;
  spendLimitDaily?: string | null;
  spendLimitTotal?: string | null;
  usageLimit?: number | null;
  allowedAssets?: string[];
  allowedProtocols?: string[];
};

export function buildExecutionPolicy(input: PolicyRequest, policyVersion: string) {
  const approvedSurface = getApprovedStrategySurface();
  const allowedContracts = approvedSurface.allowedContracts.map((value) => value.toLowerCase());
  const allowedSelectors = approvedSurface.allowedSelectors.map((value) => value.toLowerCase());
  const approvedAssets = new Set(approvedSurface.allowedAssets.map((value) => value.toUpperCase()));
  const approvedProtocols = new Set(approvedSurface.allowedProtocols.map((value) => value.toUpperCase()));
  const requestedAssets = (input.allowedAssets ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean);
  const requestedProtocols = (input.allowedProtocols ?? []).map((value) => value.trim().toUpperCase()).filter(Boolean);
  const allowedAssets = (requestedAssets.length
    ? requestedAssets.filter((value) => approvedAssets.has(value))
    : approvedSurface.allowedAssets
  ).map((value) => value.toUpperCase());
  const allowedProtocols = (requestedProtocols.length
    ? requestedProtocols.filter((value) => approvedProtocols.has(value))
    : approvedSurface.allowedProtocols
  );
  const validAfter = input.validAfter ?? new Date().toISOString();
  const validUntil =
    input.validUntil ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    policyVersion,
    domain: "execution" as const,
    allowedContracts,
    allowedSelectors,
    allowedAssets,
    allowedProtocols,
    spendToken: input.spendToken ?? "USDC",
    spendLimitPerUse: input.spendLimitPerUse ?? "1000",
    spendLimitDaily: input.spendLimitDaily ?? "2500",
    spendLimitTotal: input.spendLimitTotal ?? "10000",
    usageLimit: input.usageLimit ?? 25,
    validAfter,
    validUntil,
    humanSummary:
      `Delegated execution on chain ${parseRuntimeChainId()} with registry-pinned strategy contracts, selectors, spend caps, and bounded lifetime.`,
    rawPolicy: {
      allowedChains: [parseRuntimeChainId()],
      approvedStrategyKeys: approvedSurface.strategyKeys,
      allowedContracts,
      allowedSelectors,
      allowedAssets,
      allowedProtocols,
      spendToken: input.spendToken ?? "USDC",
      spendLimitPerUse: input.spendLimitPerUse ?? "1000",
      spendLimitDaily: input.spendLimitDaily ?? "2500",
      spendLimitTotal: input.spendLimitTotal ?? "10000",
      usageLimit: input.usageLimit ?? 25,
      validAfter,
      validUntil,
      ownerEoa: input.ownerEoa.toLowerCase(),
      userId: input.userId ?? null,
      vaultId: input.vaultId ?? null,
      vaultAddress: input.vaultAddress.toLowerCase(),
    },
  };
}

export function buildBenchmarkPolicy(input: PolicyRequest, benchmarkContract: string, policyVersion: string) {
  return {
    policyVersion,
    domain: "benchmark" as const,
    allowedContracts: [benchmarkContract.toLowerCase()],
    allowedSelectors: ["0xdce483dd", "0x6a108f39"],
    validAfter: input.validAfter ?? new Date().toISOString(),
    validUntil:
      input.validUntil ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    humanSummary:
      "Public NeuralRate benchmark identity may write benchmark records through the dedicated agent smart wallet.",
    rawPolicy: {
      benchmarkContract: benchmarkContract.toLowerCase(),
      allowedSelectors: ["0xdce483dd", "0x6a108f39"],
      ownerEoa: input.ownerEoa.toLowerCase(),
      userId: input.userId ?? null,
      vaultId: input.vaultId ?? null,
      vaultAddress: input.vaultAddress.toLowerCase(),
    },
  };
}
