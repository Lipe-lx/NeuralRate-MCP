import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";

  const registry = await ethers.getContractAt("INeuralRatePolicyRegistry", registryAddress);
  
  try {
    const policy = await registry.getActivePolicy(vaultAddress);
    console.log("Active policy for vault:", vaultAddress);
    console.log("policyId:", policy.policyId);
    console.log("ownerEoa:", policy.ownerEoa);
    console.log("vaultAddress:", policy.vaultAddress);
    console.log("delegate:", policy.delegate);
    console.log("maxPerUse:", policy.maxPerUse.toString());
    console.log("maxDaily:", policy.maxDaily.toString());
    console.log("maxTotal:", policy.maxTotal.toString());
    console.log("validAfter:", new Date(Number(policy.validAfter) * 1000).toISOString());
    console.log("validUntil:", new Date(Number(policy.validUntil) * 1000).toISOString());
    console.log("maxSlippageBps:", policy.maxSlippageBps.toString());
    console.log("nonce:", policy.nonce.toString());
    console.log("active:", policy.active);
    console.log("requireSnapshot:", policy.requireSnapshot);
    console.log("hasTargetAllowlist:", policy.hasTargetAllowlist);
    console.log("hasSelectorAllowlist:", policy.hasSelectorAllowlist);
  } catch (error) {
    console.error("Error reading policy:", error);
  }
}

main().catch(console.error);
