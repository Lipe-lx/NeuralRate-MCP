import Safe from '@safe-global/protocol-kit';
import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  const newGuardAddress = process.env.NEURALRATE_EXECUTION_GUARD_CONTRACT;
  if (!newGuardAddress) {
    throw new Error("NEURALRATE_EXECUTION_GUARD_CONTRACT is not set in env");
  }

  const [signer] = await ethers.getSigners();
  console.log("Using signer address:", signer.address);

  // EIP-1193 wrapper for ethers.provider
  const provider = {
    request: async ({ method, params }: { method: string, params?: any[] }) => {
      return ethers.provider.send(method, params || []);
    }
  };

  console.log("Initializing Safe Protocol Kit...");
  const safe = await Safe.init({
    provider: provider as any,
    signer: signer.address,
    safeAddress: vaultAddress
  });

  console.log("Current module guard:", await safe.getModuleGuard());

  console.log(`Creating transaction to set module guard to ${newGuardAddress}...`);
  const safeTransaction = await safe.createEnableModuleGuardTx(newGuardAddress);

  console.log("Executing transaction...");
  const result = await safe.executeTransaction(safeTransaction);
  console.log("Transaction hash:", result.hash);

  console.log("Waiting for confirmation via polling receipt...");
  let receipt = null;
  while (!receipt) {
    try {
      receipt = await ethers.provider.getTransactionReceipt(result.hash);
      if (receipt) break;
    } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log("Transaction confirmed in block", receipt?.blockNumber);

  console.log("Verifying new module guard on-chain...");
  const updatedGuard = await safe.getModuleGuard();
  console.log("New module guard is:", updatedGuard);
}

main().catch(console.error);
