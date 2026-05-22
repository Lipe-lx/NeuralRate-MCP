import { ethers } from "hardhat";

async function main() {
  console.log("Deploying StableSyncDecisionBenchmark...");
  
  const StableSyncDecisionBenchmark = await ethers.getContractFactory("StableSyncDecisionBenchmark");
  const contract = await StableSyncDecisionBenchmark.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`StableSyncDecisionBenchmark deployed to: ${address}`);
  console.log(`Update your .env STABLESYNC_BENCHMARK_CONTRACT with this address`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
