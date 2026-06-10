import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0x9dDbbb5f9a3cC1C0e744D20Ba6b0fa50fb22a3FF";
  const snapshotHash = "0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a";

  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);
  console.log("Fetching active policy for vault:", vaultAddress);
  try {
    const policy = await registry.getActivePolicy(vaultAddress);
    const policyId = policy.policyId;

    console.log("On-Chain Active Policy ID:", policyId);
    console.log("  maxPerUse:", policy.maxPerUse.toString());
    console.log("  maxDaily:", policy.maxDaily.toString());
    console.log("  maxTotal:", policy.maxTotal.toString());
    console.log("  active:", policy.active);
    console.log("  requireSnapshot:", policy.requireSnapshot);

    // Check snapshot anchor
    const snapshot = await registry.getSnapshotAnchor(snapshotHash);
    console.log("Snapshot anchor on-chain for hash:", snapshotHash);
    console.log("  exists:", snapshot.exists);
    console.log("  vaultAddress:", snapshot.vaultAddress);
    console.log("  policyId:", snapshot.policyId);
    console.log("  anchoredBy:", snapshot.anchoredBy);
  } catch (error: any) {
    console.error("Failed to query details:", error.message || error);
  }
}

main().catch(console.error);
