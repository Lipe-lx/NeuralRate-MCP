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
  process.env.NEURALRATE_POLICY_REGISTRY_CONTRACT = "0x0000000000000000000000000000000000000001";
  process.env.NEURALRATE_AGENT_SMART_WALLET = "0xc57130F28f3d670cA75AD9a78784966B767E55e3";
  process.env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS = "0xc57130F28f3d670cA75AD9a78784966B767E55e3";

  const { extractDecisionCreated } = await import("./benchmarkExecutor.js");

  const topics = encodeEventTopics({
    abi: [
      {
        type: "event",
        name: "DecisionReceiptCreated",
        inputs: [
          { indexed: true, name: "receiptId", type: "uint256" },
          { indexed: false, name: "externalDecisionId", type: "string" },
          { indexed: true, name: "vaultAddress", type: "address" },
          { indexed: true, name: "delegate", type: "address" },
          { indexed: false, name: "policyVersion", type: "string" },
          { indexed: false, name: "strategyKey", type: "string" },
          { indexed: false, name: "snapshotHash", type: "bytes32" },
          { indexed: false, name: "snapshotCID", type: "string" },
          { indexed: false, name: "predictedApyBps", type: "int256" },
          { indexed: false, name: "settlementHorizonHours", type: "uint256" },
        ],
      },
    ],
    eventName: "DecisionReceiptCreated",
    args: {
      receiptId: 17n,
      vaultAddress: "0x1111111111111111111111111111111111111111",
      delegate: "0x2222222222222222222222222222222222222222",
    },
  });

  const data = encodeAbiParameters(
    [
      { name: "externalDecisionId", type: "string" },
      { name: "policyVersion", type: "string" },
      { name: "strategyKey", type: "string" },
      { name: "snapshotHash", type: "bytes32" },
      { name: "snapshotCID", type: "string" },
      { name: "predictedApyBps", type: "int256" },
      { name: "settlementHorizonHours", type: "uint256" },
    ],
    [
      "decision_017",
      "vault-v2",
      "mnt-native-transfer",
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "ipfs://snapshot-1",
      550n,
      24n,
    ]
  );

  const parsed = extractDecisionCreated([
    {
      address: "0xc51560a5512d2A5756435d87319aeaE1bA480165",
      topics,
      data,
    },
  ]);

  assert.equal(parsed.onchainDecisionId, "17");
  assert.equal(parsed.vaultAddress, "0x1111111111111111111111111111111111111111");
});
