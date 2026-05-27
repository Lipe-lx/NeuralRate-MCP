import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 5003) {
    throw new Error(`This configuration script is locked to Mantle Sepolia (5003). Current chainId: ${chainId}`);
  }

  const vaultModuleAddress = process.env.NEURALRATE_VAULT_MODULE_ADDRESS?.trim();
  const executionGuardAddress = process.env.NEURALRATE_EXECUTION_GUARD_CONTRACT?.trim();

  if (!vaultModuleAddress || !executionGuardAddress) {
    throw new Error(
      "Set NEURALRATE_VAULT_MODULE_ADDRESS and NEURALRATE_EXECUTION_GUARD_CONTRACT before configuring the vault module."
    );
  }

  const vaultModule = await ethers.getContractAt("NeuralRateVaultModule", vaultModuleAddress);
  const currentGuard = (await vaultModule.executionGuard()).toLowerCase();
  if (currentGuard === executionGuardAddress.toLowerCase()) {
    console.log(`NeuralRateVaultModule already points to execution guard ${executionGuardAddress}`);
    return;
  }

  console.log(`Updating NeuralRateVaultModule ${vaultModuleAddress} execution guard to ${executionGuardAddress}...`);
  const tx = await vaultModule.setExecutionGuard(executionGuardAddress);
  await tx.wait();
  console.log(`Execution guard updated in tx ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
