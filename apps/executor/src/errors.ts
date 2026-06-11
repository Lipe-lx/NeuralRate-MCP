const MAX_COMPACT_ERROR_LENGTH = 700;

const redactSecrets = (message: string) =>
  message
    .replace(/apikey=[^\s&]+/gi, "apikey=<redacted>")
    .replace(/api_key=[^\s&]+/gi, "api_key=<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer <redacted>");

const firstMatch = (message: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
};

export function compactExecutorError(error: unknown, context?: string) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = redactSecrets(raw);
  const lower = message.toLowerCase();

  let summary: string;
  if (lower.includes("insufficient funds for transfer") || lower.includes("exceeds the balance of the account")) {
    summary = "Managed benchmark signer has insufficient MNT for the direct on-chain gas payment.";
  } else if (message.includes("Only owner, delegate or vault can anchor snapshot")) {
    summary = "Snapshot anchoring rejected: the managed signer is not the active policy owner, delegate, or vault.";
  } else if (message.includes("Only receipt writer can call this")) {
    summary = "Benchmark receipt rejected: the managed signer is not the registry receiptWriter.";
  } else if (message.includes("AA23 reverted Untrusted module")) {
    summary = "ERC-4337 validation rejected the operation because the Safe module is not trusted by the validator.";
  } else {
    summary =
      firstMatch(message, [
        /Details:\s*([^\n]+)/i,
        /Execution reverted with reason:\s*([^\n]+)/i,
        /UserOperation reverted during simulation with reason:\s*([^\n]+)/i,
      ]) ?? message.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "Unknown executor error";
  }

  const withContext = context ? `${context}: ${summary}` : summary;
  return withContext.length > MAX_COMPACT_ERROR_LENGTH
    ? `${withContext.slice(0, MAX_COMPACT_ERROR_LENGTH - 3)}...`
    : withContext;
}
