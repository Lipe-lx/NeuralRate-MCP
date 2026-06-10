import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0x94df9577f3ad55bc5c106a6e631bb2f3381f4ace";
  const snapshotHash1 = "0x1dce18d8fd81bd45787db4a3bf256ce4429e06a4509c0714c8bf7506e5a13913";
  const snapshotHash2 = "0x120607e0776c89a0c575200f18d4b7a71a0344ff37e992d44e1f894f65a187b9";

  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);
  console.log("Fetching active policy for vault:", vaultAddress);
  try {
    const policy = await registry.getActivePolicy(vaultAddress);
    const policyId = policy.policyId;

    console.log("On-Chain Active Policy ID:", policyId);
    console.log("  ownerEoa:", policy.ownerEoa);
    console.log("  vaultAddress:", policy.vaultAddress);
    console.log("  delegate:", policy.delegate);
    console.log("  maxPerUse:", policy.maxPerUse.toString());
    console.log("  maxDaily:", policy.maxDaily.toString());
    console.log("  maxTotal:", policy.maxTotal.toString());
    console.log("  active:", policy.active);
    console.log("  requireSnapshot:", policy.requireSnapshot);
    console.log("  hasTargetAllowlist:", policy.hasTargetAllowlist);
    console.log("  hasSelectorAllowlist:", policy.hasSelectorAllowlist);
    console.log("  validAfter:", policy.validAfter.toString());
    console.log("  validUntil:", policy.validUntil.toString());

    // Query selector and target allowlist status
    const isAllowedSel = await registry.isAllowedSelector(policyId, "0x00000000");
    console.log("  is 0x00000000 allowed selector:", isAllowedSel);
    
    const isAllowedTar = await registry.isAllowedTarget(policyId, "0x053ddf34340b4f36f6ff71e723193e8321b6f393");
    console.log("  is recipient target allowed:", isAllowedTar);

    // Check snapshot anchors
    const snapshot1 = await registry.getSnapshotAnchor(snapshotHash1);
    console.log("Snapshot 1 exists:", snapshot1.exists);
    console.log("  vaultAddress:", snapshot1.vaultAddress);
    console.log("  policyId:", snapshot1.policyId);

    const snapshot2 = await registry.getSnapshotAnchor(snapshotHash2);
    console.log("Snapshot 2 exists:", snapshot2.exists);
    console.log("  vaultAddress:", snapshot2.vaultAddress);
    console.log("  policyId:", snapshot2.policyId);

    // Query validator config
    const validatorAddress = "0x0A03F7763d53757183aD86C393eEfF6D8177e4cE";
    const validator = await ethers.getContractAt("NeuralRateDelegateValidator", validatorAddress);
    const isInit = await validator.isInitialized(vaultAddress);
    console.log("\nValidator isInitialized for vault:", isInit);
    if (isInit) {
      const config = await validator.getConfig(vaultAddress);
      console.log("Validator Config:");
      console.log("  delegate:", config.delegate);
      console.log("  policyRegistry:", config.policyRegistry);
      console.log("  vaultModule:", config.vaultModule);
    }

    // Query vault module config
    const moduleAddress = "0xf7061501a464e893636a5BF8eB4ab7Ba2819154D";
    const module = await ethers.getContractAt("NeuralRateVaultModule", moduleAddress);
    const guardAddress = await module.executionGuard();
    console.log("\nVault Module executionGuard address:", guardAddress);

    // Query execution guard config
    if (guardAddress !== ethers.ZeroAddress) {
      const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);
      const trustedModule = await guard.trustedModule();
      const trustedSafeModule = await guard.trustedSafeModule();
      const guardRegistry = await guard.policyRegistry();
      console.log("Execution Guard Config:");
      console.log("  trustedModule:", trustedModule);
      console.log("  trustedSafeModule:", trustedSafeModule);
      console.log("  policyRegistry:", guardRegistry);
    }
  } catch (error: any) {
    console.error("Failed to query details:", error.message || error);
  }
}

main().catch(console.error);
