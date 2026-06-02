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

const parseRuntimeChainId = () => {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const raw =
    runtime.process?.env
      ? Number.parseInt(runtime.process.env.NEURALRATE_CHAIN_ID || "", 10)
      : Number.NaN;
  return Number.isFinite(raw) ? raw : 5003;
};

const DEFAULT_ALLOWED_PROTOCOLS = ["neuralrate-usdy-vault-module", "neuralrate-mnt-vault-module"];
const DEFAULT_ALLOWED_ASSETS = ["USDY", "MNT"];
const DEFAULT_ALLOWED_SELECTORS = ["0x6a108f39", "0xdce483dd"];

export function buildExecutionPolicy(input: PolicyRequest, policyVersion: string) {
  const validAfter = input.validAfter ?? new Date().toISOString();
  const validUntil =
    input.validUntil ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const allowedAssets =
    input.allowedAssets?.map((value) => value.trim().toUpperCase()).filter(Boolean) ??
    DEFAULT_ALLOWED_ASSETS;
  const allowedProtocols =
    input.allowedProtocols?.map((value) => value.trim().toUpperCase()).filter(Boolean) ??
    DEFAULT_ALLOWED_PROTOCOLS;

  return {
    policyVersion,
    domain: "execution" as const,
    allowedContracts: [],
    allowedSelectors: DEFAULT_ALLOWED_SELECTORS,
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
      `Delegated execution on chain ${parseRuntimeChainId()} with scoped selectors, asset/protocol allowlists, and bounded limits.`,
    rawPolicy: {
      allowedChains: [parseRuntimeChainId()],
      allowedSelectors: DEFAULT_ALLOWED_SELECTORS,
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
    allowedSelectors: DEFAULT_ALLOWED_SELECTORS,
    validAfter: input.validAfter ?? new Date().toISOString(),
    validUntil:
      input.validUntil ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    humanSummary:
      "Public NeuralRate benchmark identity may write benchmark records through the dedicated agent smart wallet.",
    rawPolicy: {
      benchmarkContract: benchmarkContract.toLowerCase(),
      allowedSelectors: DEFAULT_ALLOWED_SELECTORS,
      ownerEoa: input.ownerEoa.toLowerCase(),
      userId: input.userId ?? null,
      vaultId: input.vaultId ?? null,
      vaultAddress: input.vaultAddress.toLowerCase(),
    },
  };
}
