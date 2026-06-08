import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  
  const abi = [
    "function getModuleGuard() external view returns (address)",
    "function getGuard() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(vaultAddress, abi, ethers.provider);
  
  try {
    const moduleGuard = await vault.getModuleGuard();
    console.log("getModuleGuard() returned:", moduleGuard);
  } catch (e: any) {
    console.log("getModuleGuard() failed:", e.message || e);
  }

  try {
    const txGuard = await vault.getGuard();
    console.log("getGuard() returned:", txGuard);
  } catch (e: any) {
    console.log("getGuard() failed:", e.message || e);
  }

  // Let's read the storage slot for module guard
  // In Safe v1.5.0, where is the module guard stored?
  // Let's scan some slots or try to find it. But getModuleGuard should work if the contract has it.
}

main().catch(console.error);
