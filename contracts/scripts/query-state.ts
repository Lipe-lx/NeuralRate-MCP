import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  const snapshotHash = "0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a";

  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);

  console.log("Querying active policy for vault:", vaultAddress);
  try {
    const activePolicy = await registry.getActivePolicy(vaultAddress);
    console.log("Active Policy Details:");
    console.log("  policyId:", activePolicy.policyId);
    console.log("  ownerEoa:", activePolicy.ownerEoa);
    console.log("  vaultAddress:", activePolicy.vaultAddress);
    console.log("  delegate:", activePolicy.delegate);
    console.log("  active:", activePolicy.active);
    console.log("  requireSnapshot:", activePolicy.requireSnapshot);
    console.log("  policyVersion:", activePolicy.policyVersion);
    console.log("  nonce:", activePolicy.nonce.toString());
  } catch (err: any) {
    console.error("Failed to query active policy:", err.message || err);
  }

  console.log("\nQuerying snapshot anchor for hash:", snapshotHash);
  try {
    const snapshot = await registry.getSnapshotAnchor(snapshotHash);
    console.log("Snapshot Anchor Details:");
    console.log("  exists:", snapshot.exists);
    console.log("  vaultAddress:", snapshot.vaultAddress);
    console.log("  policyId:", snapshot.policyId);
    console.log("  anchoredBy:", snapshot.anchoredBy);
    console.log("  snapshotCid:", snapshot.snapshotCid);
    console.log("  descriptor:", snapshot.descriptor);
    console.log("  anchoredAt:", snapshot.anchoredAt.toString());
  } catch (err: any) {
    console.error("Failed to query snapshot anchor:", err.message || err);
  }
}

main().catch(console.error);
