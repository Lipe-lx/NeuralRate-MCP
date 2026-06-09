import { ethers } from "hardhat";

async function main() {
  const validatorAddress = "0x0A03F7763d53757183aD86C393eEfF6D8177e4cE";
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  
  const abi = [
    "function getDelegate(address smartAccount) external view returns (address)"
  ];
  
  const validator = new ethers.Contract(validatorAddress, abi, ethers.provider);
  try {
    const delegate = await validator.getDelegate(vaultAddress);
    console.log("Delegate for vault:", delegate);
  } catch (e: any) {
    console.error("Failed to read delegate:", e.message || e);
  }
}

main().catch(console.error);
