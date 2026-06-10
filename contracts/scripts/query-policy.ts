import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0xd9afd65e5361d9a098e0fe30b914883f7c82f743";
  const snapshotHash = "0x08ef47c944e410b1d381d06db778ae2a9072736eef6db2011bfe4a9ae7c22d0b";

  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);
  console.log("Fetching active policy for vault:", vaultAddress);
  try {
    const policy = await registry.getActivePolicy(vaultAddress);
    const policyId = policy.policyId;

    console.log("On-Chain Active Policy ID:", policyId);
    
    // Check selectors
    const selectors = ["0x00000000", "0xa9059cbb", "0x095ea7b3"];
    for (const sel of selectors) {
      const allowed = await registry.isAllowedSelector(policyId, sel);
      console.log(`  Selector ${sel} allowed:`, allowed);
    }

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
