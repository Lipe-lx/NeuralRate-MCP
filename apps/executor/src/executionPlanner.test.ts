import assert from "node:assert/strict";
import test from "node:test";
import { keccak256, type Address, type Hex } from "viem";
import { protocolRegistry, tokenRegistry } from "./executionRegistry.js";
import { resolveExecutionPlan, validateProtocolDeployment } from "./executionPlanner.js";

const withConfiguredUsdYToken = async (fn: () => Promise<void>) => {
  const originalAddress = tokenRegistry.USDY.address;
  tokenRegistry.USDY.address = "0x2222222222222222222222222222222222222222" as Address;
  try {
    await fn();
  } finally {
    tokenRegistry.USDY.address = originalAddress;
  }
};

const withConfiguredVaultModuleProtocol = async (fn: () => Promise<void>) => {
  const protocol = protocolRegistry["neuralrate-vault-module-v1"];
  const originalAddress = protocol.address;
  const originalHash = protocol.expectedBytecodeHash;
  const originalStatus = protocol.deploymentStatus;

  protocol.address = "0x1111111111111111111111111111111111111111" as Address;
  protocol.expectedBytecodeHash = keccak256("0x6001600055");
  protocol.deploymentStatus = "pinned";

  try {
    await fn();
  } finally {
    protocol.address = originalAddress;
    protocol.expectedBytecodeHash = originalHash;
    protocol.deploymentStatus = originalStatus;
  }
};

test("resolveExecutionPlan blocks when runtime bytecode is missing on-chain", async () => {
  await withConfiguredUsdYToken(async () => {
    await withConfiguredVaultModuleProtocol(async () => {
      const plan = await resolveExecutionPlan(
        {
          async getCode() {
            return "0x";
          },
          async readContract() {
            return false;
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
      assert.equal(plan.validationReason, "Canonical Sepolia venue for USDY is not configured. NeuralRate will not simulate an Ondo venue on testnet.");
      assert.equal(plan.bytecodeValidation.status, "code-missing");
      assert.equal(plan.calldata, null);
    });
  });
});

test("resolveExecutionPlan prepares a real MNT Safe-module transfer on Mantle Sepolia", async () => {
  await withConfiguredVaultModuleProtocol(async () => {
    const plan = await resolveExecutionPlan(
      {
        async getCode() {
          return "0x6001600055";
        },
        async readContract() {
          return true;
        },
      },
      "mnt-native-transfer",
      {
        targetAsset: "MNT",
        amountUsd: 1,
        amountToken: 1,
        slippageBps: 0,
      },
      {
        ownerEoa: "0xc57130F28f3d670cA75AD9a78784966B767E55e3",
        vaultAddress: "0x1111111111111111111111111111111111111111",
        chainId: 5003,
        policyVersion: "v1",
        maxActionUsd: 10,
        maxAutomationUsd: 100,
        allowedAssets: ["MNT"],
        allowedProtocols: [],
      },
    );

    assert.equal(plan.validationStatus, "ready");
    assert.equal(plan.targetAsset, "MNT");
    assert.notEqual(plan.calldata, null);
    assert.match(plan.executionSummary, /ready to move 1 MNT/);
  });
});

test("resolveExecutionPlan throws for unsupported strategy keys", async () => {
  await assert.rejects(
    () =>
      resolveExecutionPlan(
        {
          async getCode() {
            return "0x";
          },
          async readContract() {
            return false;
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
  await withConfiguredUsdYToken(async () => {
    const plan = await resolveExecutionPlan(
      {
        async getCode() {
          return "0x";
        },
        async readContract() {
          return false;
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
});

test("validateProtocolDeployment succeeds when runtime bytecode hash matches", async () => {
  const protocol = protocolRegistry["neuralrate-vault-module-v1"];
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
