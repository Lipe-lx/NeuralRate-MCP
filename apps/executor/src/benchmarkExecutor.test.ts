import test from "node:test";
import assert from "node:assert/strict";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { RemoteManagedSigner } from "./managedSigner.js";

test("remote managed signer does not advertise execution before implementation", () => {
  const signer = new RemoteManagedSigner("https://example.invalid", null);
  assert.equal(signer.getCapabilities().canExecute, false);
});

test("extractDecisionCreated parses the on-chain decision id from logs", async () => {
  process.env.NEURALRATE_DATA_API_BASE_URL = "http://127.0.0.1:8787/api";
  process.env.NEURALRATE_BENCHMARK_CONTRACT = "0xc51560a5512d2A5756435d87319aeaE1bA480165";
  process.env.NEURALRATE_AGENT_SMART_WALLET = "0xc57130F28f3d670cA75AD9a78784966B767E55e3";
  process.env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS = "0xc57130F28f3d670cA75AD9a78784966B767E55e3";

  const { extractDecisionCreated } = await import("./benchmarkExecutor.js");

  const topics = encodeEventTopics({
    abi: [
      {
        type: "event",
        name: "DecisionCreated",
        inputs: [
          { indexed: true, name: "decisionId", type: "uint256" },
          { indexed: true, name: "requestedBy", type: "address" },
          { indexed: false, name: "dataSnapshotHash", type: "string" },
          { indexed: false, name: "predictedApyBps", type: "int256" },
          { indexed: false, name: "settlementHorizonHours", type: "uint256" },
        ],
      },
    ],
    eventName: "DecisionCreated",
    args: {
      decisionId: 17n,
      requestedBy: "0x1111111111111111111111111111111111111111",
    },
  });

  const data = encodeAbiParameters(
    [
      { name: "dataSnapshotHash", type: "string" },
      { name: "predictedApyBps", type: "int256" },
      { name: "settlementHorizonHours", type: "uint256" },
    ],
    ["snapshot-1", 550n, 24n]
  );

  const parsed = extractDecisionCreated([
    {
      address: "0xc51560a5512d2A5756435d87319aeaE1bA480165",
      topics,
      data,
    },
  ]);

  assert.equal(parsed.onchainDecisionId, "17");
  assert.equal(parsed.requestedBy, "0x1111111111111111111111111111111111111111");
});
