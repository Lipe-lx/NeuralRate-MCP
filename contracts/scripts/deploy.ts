import { ethers } from "hardhat";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

type DeploymentManifest = {
  network: string;
  chainId: number;
  contractName: string;
  address: string;
  txHash: string;
  expectedBytecodeHash: string;
  owner: string;
  receiptWriter?: string;
  deploymentMode?: string;
  agentId: string;
  agentURI: string;
  updatedAt: string;
};

const EMPTY_CODE_HASH = ethers.keccak256("0x");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForRuntimeCode = async (address: string, attempts = 12, delayMs = 2000) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const runtimeCode = await ethers.provider.getCode(address);
    if (runtimeCode && runtimeCode !== "0x") {
      return runtimeCode;
    }
    if (attempt < attempts) {
      console.log(`Runtime bytecode not available yet at ${address}. Retrying (${attempt}/${attempts})...`);
      await sleep(delayMs);
    }
  }
  throw new Error(`No runtime bytecode found at ${address} after ${attempts} attempts.`);
};

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  console.log("Deploying NeuralRateDecisionReceiptRegistry...");
  console.log("Using deployer address:", signer.address);

  const configuredBenchmarkWriter = process.env.NEURALRATE_AGENT_SMART_WALLET?.trim();
  const allowLegacyWriter = process.env.ALLOW_LEGACY_BENCHMARK_WRITER === "true";
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const isMissingWriter =
    !configuredBenchmarkWriter ||
    configuredBenchmarkWriter.toLowerCase() === zeroAddress.toLowerCase();

  if (isMissingWriter && !allowLegacyWriter) {
    throw new Error(
      "Missing a real NEURALRATE_AGENT_SMART_WALLET. Set the agent smart wallet address in .env, or explicitly opt into legacy deployment with ALLOW_LEGACY_BENCHMARK_WRITER=true."
    );
  }

  const initialBenchmarkWriter = isMissingWriter ? signer.address : configuredBenchmarkWriter!;
  console.log("Initial receipt writer:", initialBenchmarkWriter);

  const ReceiptRegistry = await ethers.getContractFactory("NeuralRateDecisionReceiptRegistry");
  const contract = await ReceiptRegistry.deploy(initialBenchmarkWriter);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash ?? "";
  const runtimeCode = await waitForRuntimeCode(address);
  const expectedBytecodeHash = ethers.keccak256(runtimeCode);
  if (expectedBytecodeHash === EMPTY_CODE_HASH) {
    throw new Error(`No runtime bytecode found at ${address}. Refusing to write the deployment manifest.`);
  }
  const manifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia.json");

  let manifest: DeploymentManifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRateDecisionReceiptRegistry",
    address,
    txHash,
    expectedBytecodeHash,
    owner: signer.address,
    receiptWriter: initialBenchmarkWriter,
    deploymentMode: "agent-smart-wallet",
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

  console.log(`NeuralRateDecisionReceiptRegistry deployed to: ${address}`);
  console.log(`Deployment tx hash: ${txHash}`);
  console.log(`Update your .env NEURALRATE_BENCHMARK_CONTRACT with this address`);
  console.log(`Deployment manifest updated: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
