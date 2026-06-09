import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const policyId = "0xfb769ff5db96e50248addeda04f380d222882ca1e040cf81588456a2d02a317a";

  const registry = await ethers.getContractAt("INeuralRatePolicyRegistry", registryAddress);
  
  const isAllowed = await registry.isAllowedSelector(policyId, "0x00000000");
  console.log("Is 0x00000000 allowed selector?", isAllowed);

  // Let's also check if snapshot anchor exists
  const snapshotHash = "0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a";
  const snapshot = await registry.getSnapshotAnchor(snapshotHash);
  console.log("Snapshot anchor exists?", snapshot.exists);
}

main().catch(console.error);
