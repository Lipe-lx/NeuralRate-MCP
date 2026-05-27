import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";

type DeploymentManifest = {
  network: string;
  chainId: number;
  contractName: string;
  address: string;
  txHash: string;
  expectedBytecodeHash: string;
  authorizedExecutor: string;
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

  const configuredExecutor =
    process.env.NEURALRATE_VAULT_MODULE_EXECUTOR_ADDRESS?.trim() ||
    process.env.TURNKEY_WALLET_ACCOUNT_ADDRESS?.trim() ||
    process.env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS?.trim();
  const configuredExecutionGuard =
    process.env.NEURALRATE_EXECUTION_GUARD_CONTRACT?.trim() ||
    "0x0000000000000000000000000000000000000000";

  if (!configuredExecutor || configuredExecutor === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "Missing a real vault module executor address. Set NEURALRATE_VAULT_MODULE_EXECUTOR_ADDRESS, TURNKEY_WALLET_ACCOUNT_ADDRESS or NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS in .env."
    );
  }

  console.log("Deploying NeuralRateVaultModule...");
  console.log("Using deployer address:", signer.address);
  console.log("Authorized executor:", configuredExecutor);
  console.log("Execution guard:", configuredExecutionGuard);

  const Module = await ethers.getContractFactory("NeuralRateVaultModule");
  const contract = await Module.deploy(configuredExecutor, configuredExecutionGuard);

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const txHash = contract.deploymentTransaction()?.hash ?? "";
  const runtimeCode = await waitForRuntimeCode(address);
  const expectedBytecodeHash = ethers.keccak256(runtimeCode);
  if (expectedBytecodeHash === EMPTY_CODE_HASH) {
    throw new Error(`Resolved runtime bytecode hash is empty for ${address}. Refusing to pin an invalid manifest.`);
  }

  const manifest: DeploymentManifest = {
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRateVaultModule",
    address,
    txHash,
    expectedBytecodeHash,
    authorizedExecutor: configuredExecutor,
    updatedAt: new Date().toISOString(),
  };

  const jsonManifestPath = path.resolve(__dirname, "../../deployments/mantle-sepolia-vault-module.json");
  const tsManifestPath = path.resolve(__dirname, "../../apps/executor/src/generated/vaultModuleDeployment.ts");

  mkdirSync(path.dirname(jsonManifestPath), { recursive: true });
  writeFileSync(jsonManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const tsFile = `import type { Address, Hex } from "viem";

export const vaultModuleDeployment = {
  chainId: 5003,
  contractName: "NeuralRateVaultModule",
  address: "${address}" as Address,
  expectedBytecodeHash: "${expectedBytecodeHash}" as Hex,
  deploymentStatus: "pinned" as const,
  txHash: "${txHash}" as Hex,
  updatedAt: "${manifest.updatedAt}",
};
`;
  writeFileSync(tsManifestPath, tsFile);

  console.log(`NeuralRateVaultModule deployed to: ${address}`);
  console.log(`Deployment tx hash: ${txHash}`);
  console.log(`Runtime bytecode hash: ${expectedBytecodeHash}`);
  console.log(`JSON manifest updated: ${jsonManifestPath}`);
  console.log(`Executor registry manifest updated: ${tsManifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
