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

export const DEFAULT_ALLOWED_CONTRACTS = [
  "0xc51560a5512d2A5756435d87319aeaE1bA480165",
];

export const DEFAULT_ALLOWED_SELECTORS = [
  "0xdce483dd",
  "0x6a108f39",
];

export function buildExecutionPolicy(input: PolicyRequest, policyVersion: string) {
  const allowedContracts = DEFAULT_ALLOWED_CONTRACTS.map((value) => value.toLowerCase());
  const allowedSelectors = DEFAULT_ALLOWED_SELECTORS.map((value) => value.toLowerCase());
  const validAfter = input.validAfter ?? new Date().toISOString();
  const validUntil =
    input.validUntil ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    policyVersion,
    domain: "execution" as const,
    allowedContracts,
    allowedSelectors,
    allowedAssets: input.allowedAssets ?? [],
    allowedProtocols: input.allowedProtocols ?? [],
    spendToken: input.spendToken ?? "USDC",
    spendLimitPerUse: input.spendLimitPerUse ?? "1000",
    spendLimitDaily: input.spendLimitDaily ?? "2500",
    spendLimitTotal: input.spendLimitTotal ?? "10000",
    usageLimit: input.usageLimit ?? 25,
    validAfter,
    validUntil,
    humanSummary:
      "Delegated execution on Mantle Sepolia with whitelisted contracts, selectors, spend caps, and bounded lifetime.",
    rawPolicy: {
      allowedChains: [5003],
      allowedContracts,
      allowedSelectors,
      allowedAssets: input.allowedAssets ?? [],
      allowedProtocols: input.allowedProtocols ?? [],
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
