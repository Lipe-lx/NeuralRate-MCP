import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  
  // Safe contract ABI snippet to get guard
  const safeAbi = [
    "function getGuard() external view returns (address)"
  ];
  
  const safe = await ethers.getContractAt(safeAbi, vaultAddress);
  
  try {
    const guard = await safe.getGuard();
    console.log("Current guard of the safe:", guard);
  } catch (error) {
    console.error("Error calling getGuard():", error);
  }

  // Also read storage slot for guard
  // The slot is: keccak256("guard.address") or safe guard slot: 0x4a204f938c5c7863afa1dcfcd5dec9d88b3f1911d3f2b84efac0b15671d2b0e6
  // Wait, let's look at the standard slot. Safe uses slot 0x4a204f938c5c7863afa1dcfcd5dec9d88b3f1911d3f2b84efac0b15671d2b0e6
  const slot = "0x4a204f938c5c7863afa1dcfcd5dec9d88b3f1911d3f2b84efac0b15671d2b0e6";
  try {
    const guardFromStorage = await ethers.provider.getStorage(vaultAddress, slot);
    console.log("Guard from storage slot:", guardFromStorage);
  } catch (error) {
    console.error("Error reading storage slot:", error);
  }
}

main().catch(console.error);
