import { ethers } from "hardhat";

async function main() {
  const guardAddress = "0x0474EB39B7e90C11EEbD1Aa2C0A8988F7D39D0d9";
  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);
  
  console.log("Guard Address:", guardAddress);
  console.log("owner:", await guard.owner());
  console.log("policyRegistry:", await guard.policyRegistry());
  console.log("trustedModule:", await guard.trustedModule());
  console.log("trustedSafeModule:", await guard.trustedSafeModule());
}

main().catch(console.error);
