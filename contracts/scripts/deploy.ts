import { ethers } from "hardhat";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type DeploymentManifest = {
  network: string;
  chainId: number;
  contractName: string;
  address: string;
  txHash: string;
  agentId: string;
  agentURI: string;
  updatedAt: string;
};

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  console.log("Deploying NeuralRateDecisionBenchmark...");
  console.log("Using deployer address:", signer.address);

  const NeuralRateDecisionBenchmark = await ethers.getContractFactory("NeuralRateDecisionBenchmark");
  const contract = await NeuralRateDecisionBenchmark.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash ?? "";
  const manifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia.json");

  let manifest: DeploymentManifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRateDecisionBenchmark",
    address,
    txHash,
    agentId: "",
    agentURI: "",
    updatedAt: new Date().toISOString()
  };

  try {
    const previous = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<DeploymentManifest>;
    manifest = {
      ...manifest,
      agentId: previous.agentId ?? "",
      agentURI: previous.agentURI ?? ""
    };
  } catch {
    // First deployment creates the manifest from scratch.
  }

  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`NeuralRateDecisionBenchmark deployed to: ${address}`);
  console.log(`Deployment tx hash: ${txHash}`);
  console.log(`Update your .env NEURALRATE_BENCHMARK_CONTRACT with this address`);
  console.log(`Deployment manifest updated: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
