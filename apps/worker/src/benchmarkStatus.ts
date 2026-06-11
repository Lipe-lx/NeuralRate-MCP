export const hasBenchmarkProof = (record: Record<string, unknown> | null | undefined) => {
  if (!record) {
    return false;
  }

  const txHash = typeof record.tx_hash === "string" ? record.tx_hash.trim() : "";
  const onchainDecisionId = typeof record.onchain_decision_id === "string" ? record.onchain_decision_id.trim() : "";
  return txHash.length > 0 || onchainDecisionId.length > 0;
};

export const effectiveBenchmarkStatus = (record: Record<string, unknown> | null | undefined) => {
  if (hasBenchmarkProof(record)) {
    return "onchain";
  }

  const status = typeof record?.benchmark_status === "string" ? record.benchmark_status.trim() : "";
  return status || "local";
};

export const isBenchmarkRequeueBlocked = (record: Record<string, unknown> | null | undefined) =>
  effectiveBenchmarkStatus(record) === "onchain";

export const benchmarkRequeueBlockedMessage = (decisionId: string) =>
  `Decision ${decisionId} already has an on-chain benchmark receipt; requeue is not allowed.`;

export const normalizeDecisionBenchmarkStatus = <T extends Record<string, unknown>>(record: T): T => ({
  ...record,
  benchmark_status: effectiveBenchmarkStatus(record),
});
