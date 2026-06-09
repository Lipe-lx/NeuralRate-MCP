import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  const delegateAddress = "0xc57130F28f3d670cA75AD9a78784966B767E55e3";

  const [signer] = await ethers.getSigners();
  console.log("Publishing policy using signer:", signer.address);

  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);
  
  const latestBlock = await ethers.provider.getBlock("latest");
  const latestTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
  const validAfter = latestTimestamp - 3600; // 1 hour ago
  const validUntil = latestTimestamp + 3600 * 24 * 30; // 30 days from now

  // Large limits to support wei comparisons: 10^24 base units
  const maxPerUse = ethers.parseUnits("1000000", 18); // 1M
  const maxDaily = ethers.parseUnits("2500000", 18); // 2.5M
  const maxTotal = ethers.parseUnits("10000000", 18); // 10M
  const maxSlippageBps = 50;
  const requireSnapshot = true;
  const policyVersion = "vault-v1";
  const allowedAssets = ["MNT", "USDY"];
  const allowedProtocols = ["neuralrate-vault-module"];
  const allowedTargets: string[] = [];
  const allowedSelectors = ["0x00000000", "0xa9059cbb"];

  console.log("Publishing active policy on-chain...");
  const tx = await registry.publishPolicy(
    signer.address,
    vaultAddress,
    delegateAddress,
    maxPerUse,
    maxDaily,
    maxTotal,
    validAfter,
    validUntil,
    maxSlippageBps,
    requireSnapshot,
    policyVersion,
    allowedAssets,
    allowedProtocols,
    allowedTargets,
    allowedSelectors
  );
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("Confirmed in block:", receipt?.blockNumber);

  console.log("Checking active policy again...");
  const policy = await registry.getActivePolicy(vaultAddress);
  console.log("policyId:", policy.policyId);
  console.log("maxPerUse:", policy.maxPerUse.toString());
  console.log("active:", policy.active);
}

main().catch(console.error);
