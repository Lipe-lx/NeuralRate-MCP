import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const guardAddress = "0x666Bc822156824F40F2b70aAaAcBfe87467D79A5";
  const registryManifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia-policy-registry.json");
  
  if (!fs.existsSync(registryManifestPath)) {
    throw new Error(`Registry manifest not found at ${registryManifestPath}. Deploy the registry first!`);
  }

  const registryManifest = JSON.parse(fs.readFileSync(registryManifestPath, "utf8"));
  const registryAddress = registryManifest.address;

  console.log(`Updating ExecutionGuard ${guardAddress} policyRegistry to: ${registryAddress}`);
  
  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);
  const currentRegistry = await guard.policyRegistry();
  
  if (currentRegistry.toLowerCase() === registryAddress.toLowerCase()) {
    console.log("ExecutionGuard already points to the correct policy registry.");
    return;
  }

  const tx = await guard.setPolicyRegistry(registryAddress);
  console.log(`Transaction submitted: ${tx.hash}. Waiting for confirmation...`);
  await tx.wait();
  console.log("Successfully updated policyRegistry in ExecutionGuard!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
