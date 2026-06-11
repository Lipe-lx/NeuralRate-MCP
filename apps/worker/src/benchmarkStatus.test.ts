import test from "node:test";
import assert from "node:assert/strict";
import {
  benchmarkRequeueBlockedMessage,
  effectiveBenchmarkStatus,
  hasBenchmarkProof,
  isBenchmarkRequeueBlocked,
  normalizeDecisionBenchmarkStatus,
} from "./benchmarkStatus";

test("benchmark proof forces effective onchain status", () => {
  const decision = {
    decision_id: "decision_1",
    benchmark_status: "local",
    tx_hash: "0xabc",
    onchain_decision_id: null,
  };

  assert.equal(hasBenchmarkProof(decision), true);
  assert.equal(effectiveBenchmarkStatus(decision), "onchain");
  assert.equal(isBenchmarkRequeueBlocked(decision), true);
  assert.deepEqual(normalizeDecisionBenchmarkStatus(decision), {
    ...decision,
    benchmark_status: "onchain",
  });
});

test("benchmark requeue block message names the decision", () => {
  assert.match(benchmarkRequeueBlockedMessage("decision_123"), /decision_123/);
  assert.match(benchmarkRequeueBlockedMessage("decision_123"), /requeue is not allowed/);
});

test("benchmark status remains local when no proof exists", () => {
  assert.equal(effectiveBenchmarkStatus({ benchmark_status: "pending" }), "pending");
  assert.equal(effectiveBenchmarkStatus({ benchmark_status: "" }), "local");
  assert.equal(isBenchmarkRequeueBlocked({ benchmark_status: "local" }), false);
});
