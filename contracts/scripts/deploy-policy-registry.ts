import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const Registry = await ethers.getContractFactory("NeuralRatePolicyRegistry");
  const contract = await Registry.deploy();
  await contract.waitForDeployment();

  const manifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRatePolicyRegistry",
    address: await contract.getAddress(),
    txHash: contract.deploymentTransaction()?.hash ?? "",
    updatedAt: new Date().toISOString(),
  };

  const manifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia-policy-registry.json");
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`NeuralRatePolicyRegistry deployed to: ${manifest.address}`);
  console.log(`Manifest written to: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
