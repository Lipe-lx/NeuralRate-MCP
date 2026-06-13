import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

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
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This deploy script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const Registry = await ethers.getContractFactory("NeuralRatePolicyRegistry");
  const contract = await Registry.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const runtimeCode = await waitForRuntimeCode(address);
  const expectedBytecodeHash = ethers.keccak256(runtimeCode);
  if (expectedBytecodeHash === EMPTY_CODE_HASH) {
    throw new Error(`No runtime bytecode found at ${address}. Refusing to write the deployment manifest.`);
  }

  const manifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRatePolicyRegistry",
    address,
    txHash: contract.deploymentTransaction()?.hash ?? "",
    expectedBytecodeHash,
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
