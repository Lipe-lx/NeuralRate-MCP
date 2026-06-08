import assert from "node:assert/strict";
import test from "node:test";
import { compactMcpText, sanitizeJobRecordForMcp } from "./sanitize";

test("compactMcpText redacts API keys, scoped tokens, bearer tokens, and long hex blobs", () => {
  const value = [
    "https://api.pimlico.io/v2/5003/rpc?apikey=pim_XoUJ4kX6MXiEGY2FhnSzVT",
    "Authorization: Bearer secret.jwt.token",
    "sessionToken=nrmcp_4d055ccc7f5592f5ffad2bce7f2f3f3c6301d9b77c0835c2945563b1a6f7d864",
    "callData: 0xe9ae5c530000000000000000000000000000000000000000000000000000000000000000",
  ].join(" ");

  const redacted = compactMcpText(value);

  assert.match(redacted, /apikey=<redacted>/);
  assert.match(redacted, /Bearer <redacted>/);
  assert.doesNotMatch(redacted, /pim_XoUJ4kX6MXiEGY2FhnSzVT/);
  assert.doesNotMatch(redacted, /nrmcp_4d055/);
  assert.doesNotMatch(redacted, /0xe9ae5c530000000000/);
});

test("sanitizeJobRecordForMcp omits payloads and sanitizes failure reasons", () => {
  const sanitized = sanitizeJobRecordForMcp({
    job_id: "job_1",
    payload_json: "{\"amount\":1000}",
    failure_reason: "failed https://example.test/rpc?api_key=secret-key",
  });

  assert.equal(sanitized.job_id, "job_1");
  assert.equal(sanitized.payload_json_omitted, true);
  assert.equal(sanitized.payload_json, undefined);
  assert.equal(sanitized.failure_reason, "failed https://example.test/rpc?api_key=<redacted>");
});
