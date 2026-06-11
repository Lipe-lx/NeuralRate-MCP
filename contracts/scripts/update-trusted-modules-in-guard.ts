import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const MANIFEST_PATH = path.resolve(__dirname, "../../deployments/mantle-sepolia-execution-guard.json");

const assertAddress = (name: string, value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed || !ethers.isAddress(trimmed)) {
    throw new Error(`${name} must be set to a valid address.`);
  }
  return ethers.getAddress(trimmed);
};

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const guardAddress = assertAddress("NEURALRATE_EXECUTION_GUARD_CONTRACT", process.env.NEURALRATE_EXECUTION_GUARD_CONTRACT);
  const vaultModuleAddress = assertAddress("NEURALRATE_VAULT_MODULE_ADDRESS", process.env.NEURALRATE_VAULT_MODULE_ADDRESS);
  const safe7579Address = assertAddress("NEURALRATE_SAFE_7579_ADAPTER_ADDRESS", process.env.NEURALRATE_SAFE_7579_ADAPTER_ADDRESS);
  const [signer] = await ethers.getSigners();
  if (!signer) {
    throw new Error("No deployer signer is configured. Set PRIVATE_KEY or SEED_FRASE before running this script.");
  }

  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);
  const owner = ethers.getAddress(await guard.owner());
  const signerAddress = ethers.getAddress(await signer.getAddress());
  if (owner !== signerAddress) {
    throw new Error(`Signer ${signerAddress} is not the ExecutionGuard owner ${owner}.`);
  }

  const currentTrustedModule = ethers.getAddress(await guard.trustedModule());
  const currentTrustedSafeModule = ethers.getAddress(await guard.trustedSafeModule());
  const txHashes: Record<string, string> = {};

  console.log("ExecutionGuard:", guardAddress);
  console.log("Owner:", owner);
  console.log("Current trustedModule:", currentTrustedModule);
  console.log("Target trustedModule:", vaultModuleAddress);
  console.log("Current trustedSafeModule:", currentTrustedSafeModule);
  console.log("Target trustedSafeModule:", safe7579Address);

  if (currentTrustedModule !== vaultModuleAddress) {
    const tx = await guard.setTrustedModule(vaultModuleAddress);
    console.log(`setTrustedModule submitted: ${tx.hash}`);
    await tx.wait();
    txHashes.setTrustedModule = tx.hash;
  } else {
    console.log("trustedModule already matches the NeuralRate vault module.");
  }

  if (currentTrustedSafeModule !== safe7579Address) {
    const tx = await guard.setTrustedSafeModule(safe7579Address);
    console.log(`setTrustedSafeModule submitted: ${tx.hash}`);
    await tx.wait();
    txHashes.setTrustedSafeModule = tx.hash;
  } else {
    console.log("trustedSafeModule already matches the Safe7579 adapter.");
  }

  const verifiedTrustedModule = ethers.getAddress(await guard.trustedModule());
  const verifiedTrustedSafeModule = ethers.getAddress(await guard.trustedSafeModule());
  if (verifiedTrustedModule !== vaultModuleAddress || verifiedTrustedSafeModule !== safe7579Address) {
    throw new Error("ExecutionGuard trusted modules did not match the expected deployment after update.");
  }

  const manifest = fs.existsSync(MANIFEST_PATH)
    ? JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"))
    : {};
  const nextManifest = {
    ...manifest,
    network: "mantleSepolia",
    chainId,
    contractName: "NeuralRateExecutionGuard",
    address: guardAddress,
    trustedModule: verifiedTrustedModule,
    trustedSafeModule: verifiedTrustedSafeModule,
    updatedAt: new Date().toISOString(),
    lastConfigTxHashes: {
      ...(manifest.lastConfigTxHashes ?? {}),
      ...txHashes,
    },
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`);

  console.log("ExecutionGuard trusted modules are configured.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
