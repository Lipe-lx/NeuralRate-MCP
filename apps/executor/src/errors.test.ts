import test from "node:test";
import assert from "node:assert/strict";
import { compactExecutorError } from "./errors.js";

test("compactExecutorError summarizes direct gas failures", () => {
  const message = [
    "The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.",
    "",
    "Details: insufficient funds for transfer",
  ].join("\n");

  assert.equal(
    compactExecutorError(new Error(message), "Benchmark execution failed"),
    "Benchmark execution failed: Managed benchmark signer has insufficient MNT for the direct on-chain gas payment."
  );
});

test("compactExecutorError summarizes snapshot anchor authorization failures", () => {
  assert.equal(
    compactExecutorError(new Error("execution reverted: Only owner, delegate or vault can anchor snapshot")),
    "Snapshot anchoring rejected: the managed signer is not the active policy owner, delegate, or vault."
  );
});

test("compactExecutorError redacts API keys and trims huge RPC errors", () => {
  const compact = compactExecutorError(
    new Error("Failed https://rpc.test?apikey=secret-token\n\nDetails: upstream rejected request")
  );

  assert.equal(compact, "upstream rejected request");
  assert.doesNotMatch(compact, /secret-token/);
});
