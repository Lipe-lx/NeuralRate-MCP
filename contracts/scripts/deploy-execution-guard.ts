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
  const [signer] = await ethers.getSigners();
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
  const trustedSafeModule = process.env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS?.trim() || trustedModule;

  const Guard = await ethers.getContractFactory("NeuralRateExecutionGuard");
  const contract = await Guard.deploy(policyRegistry, trustedModule, trustedSafeModule);
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
    contractName: "NeuralRateExecutionGuard",
    address,
    txHash: contract.deploymentTransaction()?.hash ?? "",
    expectedBytecodeHash,
    owner: signer.address,
    policyRegistry,
    trustedModule,
    trustedSafeModule,
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
