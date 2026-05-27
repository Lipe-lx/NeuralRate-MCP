import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const policyRegistry = process.env.NEURALRATE_POLICY_REGISTRY_CONTRACT?.trim();
  const trustedModule = process.env.NEURALRATE_VAULT_MODULE_ADDRESS?.trim();
  if (!policyRegistry || !trustedModule) {
    throw new Error("Set NEURALRATE_POLICY_REGISTRY_CONTRACT and NEURALRATE_VAULT_MODULE_ADDRESS before deploying the execution guard.");
  }

  const Guard = await ethers.getContractFactory("NeuralRateExecutionGuard");
  const contract = await Guard.deploy(policyRegistry, trustedModule);
  await contract.waitForDeployment();

  const manifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRateExecutionGuard",
    address: await contract.getAddress(),
    txHash: contract.deploymentTransaction()?.hash ?? "",
    policyRegistry,
    trustedModule,
    updatedAt: new Date().toISOString(),
  };

  const manifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia-execution-guard.json");
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`NeuralRateExecutionGuard deployed to: ${manifest.address}`);
  console.log(`Manifest written to: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
