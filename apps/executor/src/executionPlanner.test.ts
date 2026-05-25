import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, type Address, type Hex } from "viem";
import { protocolRegistry } from "./executionRegistry.js";
import { resolveExecutionPlan, validateProtocolDeployment } from "./executionPlanner.js";

test("resolveExecutionPlan blocks when runtime bytecode is missing on-chain", async () => {
  const plan = await resolveExecutionPlan(
    {
      async getCode() {
        return "0x";
      },
    },
    "usdy-stable-allocation",
    {
      targetAsset: "USDY",
      amountUsd: 1000,
      slippageBps: 50,
    },
    {
      ownerEoa: "0xc57130F28f3d670cA75AD9a78784966B767E55e3",
      vaultAddress: "0x1111111111111111111111111111111111111111",
      chainId: 5003,
      policyVersion: "v1",
      maxActionUsd: 1500,
      maxAutomationUsd: 10000,
      allowedAssets: ["USDY"],
      allowedProtocols: ["neuralrate-usdy-adapter"],
    },
  );

  assert.equal(plan.strategyKey, "usdy-stable-allocation");
  assert.equal(plan.validationStatus, "blocked");
  assert.equal(plan.bytecodeValidation.status, "code-missing");
  assert.equal(plan.calldata, null);
});

test("resolveExecutionPlan throws for unsupported strategy keys", async () => {
  await assert.rejects(
    () =>
      resolveExecutionPlan(
        {
          async getCode() {
            return "0x";
          },
        },
        "unknown-strategy",
        {
          targetAsset: "USDY",
          amountUsd: 1000,
        },
        {
          ownerEoa: "0xc57130F28f3d670cA75AD9a78784966B767E55e3",
          vaultAddress: "0x1111111111111111111111111111111111111111",
          chainId: 5003,
          policyVersion: "v1",
          maxActionUsd: 1500,
          maxAutomationUsd: 10000,
          allowedAssets: ["USDY"],
          allowedProtocols: ["neuralrate-usdy-adapter"],
        },
      ),
    /Unsupported strategyKey/,
  );
});

test("resolveExecutionPlan blocks when amount exceeds policy limits", async () => {
  const plan = await resolveExecutionPlan(
    {
      async getCode() {
        return "0x";
      },
    },
    "usdy-stable-allocation",
    {
      targetAsset: "USDY",
      amountUsd: 5000,
    },
    {
      ownerEoa: "0xc57130F28f3d670cA75AD9a78784966B767E55e3",
      vaultAddress: "0x1111111111111111111111111111111111111111",
      chainId: 5003,
      policyVersion: "v1",
      maxActionUsd: 1000,
      maxAutomationUsd: 3000,
      allowedAssets: ["USDY"],
      allowedProtocols: ["neuralrate-usdy-adapter"],
    },
  );

  const actionCheck = plan.policyChecks.find((check) => check.check === "policy-max-action-usd");
  assert.equal(plan.validationStatus, "blocked");
  assert.equal(actionCheck?.ok, false);
});

test("validateProtocolDeployment succeeds when runtime bytecode hash matches", async () => {
  const protocol = protocolRegistry["neuralrate-usdy-adapter-v1"];
  const originalAddress = protocol.address;
  const originalHash = protocol.expectedBytecodeHash;
  const originalStatus = protocol.deploymentStatus;
  const code = "0x6001600055" as Hex;

  protocol.address = "0x1111111111111111111111111111111111111111" as Address;
  protocol.expectedBytecodeHash = keccak256(code);
  protocol.deploymentStatus = "pinned";

  try {
    const result = await validateProtocolDeployment(
      {
        async getCode() {
          return code;
        },
      },
      protocol.protocolId,
      5003,
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, "validated");
    assert.equal(result.observedBytecodeHash, keccak256(code));
  } finally {
    protocol.address = originalAddress;
    protocol.expectedBytecodeHash = originalHash;
    protocol.deploymentStatus = originalStatus;
  }
});
