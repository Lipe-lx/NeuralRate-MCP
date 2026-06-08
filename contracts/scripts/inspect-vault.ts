import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  
  const abi = [
    "function VERSION() external view returns (string)",
    "function getOwners() external view returns (address[])",
    "function getModulesPaginated(address start, uint256 pageSize) external view returns (address[] memory array, address next)",
    "function isModuleEnabled(address module) external view returns (bool)",
    "function getGuard() external view returns (address)"
  ];
  
  const vault = new ethers.Contract(vaultAddress, abi, ethers.provider);
  
  try {
    const version = await vault.VERSION();
    console.log("Safe VERSION:", version);
  } catch (e: any) {
    console.log("VERSION() failed:", e.message || e);
  }

  try {
    const owners = await vault.getOwners();
    console.log("Safe owners:", owners);
  } catch (e: any) {
    console.log("getOwners() failed:", e.message || e);
  }

  try {
    const [modules] = await vault.getModulesPaginated("0x0000000000000000000000000000000000000001", 10);
    console.log("Safe enabled modules:", modules);
  } catch (e: any) {
    console.log("getModulesPaginated() failed:", e.message || e);
  }

  try {
    const guard = await vault.getGuard();
    console.log("Safe guard:", guard);
  } catch (e: any) {
    console.log("getGuard() failed:", e.message || e);
  }

  // Let's do a raw call to getGuard
  try {
    const rawGuard = await ethers.provider.call({
      to: vaultAddress,
      data: "0xe161b9a9" // selector for getGuard()
    });
    console.log("raw getGuard call result:", rawGuard);
  } catch (e: any) {
    console.log("raw getGuard call failed:", e.message || e);
  }
}

main().catch(console.error);
