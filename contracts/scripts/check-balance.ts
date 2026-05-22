import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer address:", signer.address);
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Balance (wei):", balance.toString());
  console.log("Balance (eth):", ethers.formatEther(balance));
}

main().catch(console.error);
