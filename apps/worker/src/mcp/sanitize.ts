export const compactMcpText = (value: string, maxLength = 600) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  const redactedSecrets = normalized
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1<redacted>")
    .replace(/\b((?:api[_-]?key|apikey|access[_-]?token|token)\s*[:=]\s*)[^\s,&)]+/gi, "$1<redacted>")
    .replace(/([?&](?:api[_-]?key|apikey|access[_-]?token|token)=)[^&\s)]+/gi, "$1<redacted>")
    .replace(/\b(pim_[A-Za-z0-9_-]+)/g, "<redacted>")
    .replace(/\b(nrmcp_[A-Za-z0-9_-]+)/g, "<redacted>");
  const redactedHex = redactedSecrets.replace(/\b0x[a-fA-F0-9]{67,}\b/g, (match) => `${match.slice(0, 10)}...${match.slice(-8)}`);
  return redactedHex.length > maxLength ? `${redactedHex.slice(0, maxLength - 3)}...` : redactedHex;
};

export const sanitizeJobRecordForMcp = (record: Record<string, unknown>) => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "payload_json") {
      sanitized.payload_json_omitted = true;
      continue;
    }
    if (key === "failure_reason" && typeof value === "string") {
      sanitized.failure_reason = compactMcpText(value);
      continue;
    }
    if (typeof value === "string" && value.length > 800) {
      sanitized[key] = compactMcpText(value);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
};
