import Safe from '@safe-global/protocol-kit';
import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  
  // EIP-1193 wrapper for ethers.provider
  const provider = {
    request: async ({ method, params }: { method: string, params?: any[] }) => {
      return ethers.provider.send(method, params || []);
    }
  };
  
  const [signer] = await ethers.getSigners();
  
  console.log("Initializing Safe Protocol Kit...");
  const safe = await Safe.init({
    provider: provider as any,
    signer: signer.address,
    safeAddress: vaultAddress
  });
  
  console.log("Safe initialized. Address:", await safe.getAddress());
  
  try {
    const version = await safe.getContractVersion();
    console.log("Contract version:", version);
  } catch (error) {
    console.error("Error getting version:", error);
  }

  try {
    const moduleGuard = await safe.getModuleGuard();
    console.log("getModuleGuard() returned:", moduleGuard);
  } catch (error) {
    console.error("Error calling getModuleGuard():", error);
  }

  try {
    const txGuard = await safe.getGuard();
    console.log("getGuard() returned:", txGuard);
  } catch (error) {
    console.error("Error calling getGuard():", error);
  }
}

main().catch(console.error);
