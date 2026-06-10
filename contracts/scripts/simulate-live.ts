import { ethers } from "hardhat";

async function main() {
  const vaultAddress = "0x94df9577f3ad55bc5c106a6e631bb2f3381f4ace";
  const ownerEoa = "0x053ddf34340b4f36f6ff71e723193e8321b6f393";
  const targetContract = "0x053ddf34340b4f36f6ff71e723193e8321b6f393";
  const value = ethers.parseUnits("1", 18);
  const callData = "0x";
  
  // From user's log, let's try some parsed intentHash and snapshotHash values
  const intentHash = "0x57db9d1b177b81eeb7c1b5f86cf8b57d995e71100f8b98f9aedd2de54c85e989"; // tentative
  const snapshotHash = "0x1dce18d8fd81bd45787db4a3bf256ce4429e06a4509c0714c8bf7506e5a13913";
  const slippageBps = 0;
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const moduleAddress = "0xf7061501a464e893636a5BF8eB4ab7Ba2819154D";
  const guardAddress = "0x666Bc822156824F40F2b70aAaAcBfe87467D79A5";

  const module = await ethers.getContractAt("NeuralRateVaultModule", moduleAddress);
  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);

  console.log("Simulating validateAndConsumeExecution directly on guard...");
  try {
    // We impersonate the module on a local hardhat network fork to test validateAndConsumeExecution
    console.log("impersonating module address:", moduleAddress);
    await ethers.provider.send("hardhat_impersonateAccount", [moduleAddress]);
    const moduleSigner = await ethers.getSigner(moduleAddress);

    // Give module gas
    await ethers.provider.send("hardhat_setBalance", [
      moduleAddress,
      "0x10000000000000000000",
    ]);

    const guardWithModule = guard.connect(moduleSigner);
    
    // First, let's anchor the snapshot so we can isolate the failure
    console.log("impersonating vault address:", vaultAddress);
    await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
    const vaultSigner = await ethers.getSigner(vaultAddress);
    await ethers.provider.send("hardhat_setBalance", [
      vaultAddress,
      "0x10000000000000000000",
    ]);

    const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
    const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress, vaultSigner);
    
    console.log("Anchoring snapshot on local fork...");
    await (await registry.anchorSnapshot(vaultAddress, snapshotHash, "inline:cid", "desc")).wait();
    console.log("Snapshot anchored on fork!");

    console.log("Running validateAndConsumeExecution...");
    await guardWithModule.validateAndConsumeExecution(
      ownerEoa,
      vaultAddress,
      vaultAddress, // executor
      targetContract,
      value,
      callData,
      intentHash,
      snapshotHash,
      slippageBps,
      deadline
    );
    console.log("validateAndConsumeExecution SUCCESS on fork!");
  } catch (error: any) {
    console.error("validateAndConsumeExecution FAILED on fork:", error.message || error);
  }
}

main().catch(console.error);
