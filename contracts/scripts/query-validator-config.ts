import { ethers } from "hardhat";

async function main() {
  const validatorAddress = "0x0A03F7763d53757183aD86C393eEfF6D8177e4cE";
  const vaultAddress = "0xd9afd65e5361d9a098e0fe30b914883f7c82f743";

  const validator = await ethers.getContractAt("NeuralRateDelegateValidator", validatorAddress);
  console.log("Fetching config for vault:", vaultAddress);
  try {
    const config = await validator.getConfig(vaultAddress);
    console.log("Validator Config on-chain:");
    console.log("  delegate:", config.delegate);
    console.log("  policyRegistry:", config.policyRegistry);
    console.log("  vaultModule:", config.vaultModule);
  } catch (error: any) {
    console.error("Failed to fetch config:", error.message || error);
  }
}

main().catch(console.error);
