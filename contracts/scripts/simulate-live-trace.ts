import { ethers, network } from "hardhat";

const requiredAddress = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`Set a valid ${name} before running this trace simulation.`);
  }
  return value;
};

async function main() {
  if (network.name !== "hardhat") {
    console.log("This trace simulation must be run on the local 'hardhat' network.");
    return;
  }

  const vaultAddress = "0x94df9577f3ad55bc5c106a6e631bb2f3381f4ace";
  const ownerEoa = "0x053ddf34340b4f36f6ff71e723193e8321b6f393";
  const targetContract = "0x053ddf34340b4f36f6ff71e723193e8321b6f393";
  const value = ethers.parseUnits("1", 18);
  const callData = "0x";
  
  const intentHash = "0x57db9d1b177b81eeb7c1b5f86cf8b57d995e71100f8b98f9aedd2de54c85e989";
  const snapshotHash = "0x1dce18d8fd81bd45787db4a3bf256ce4429e06a4509c0714c8bf7506e5a13913";
  const slippageBps = 0;
  
  const latestBlock = await ethers.provider.getBlock("latest");
  const latestTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
  const deadline = latestTimestamp + 3600;

  console.log("Forking Mantle Sepolia at block:", latestBlock?.number);

  const registryAddress = requiredAddress("NEURALRATE_POLICY_REGISTRY_CONTRACT");
  const moduleAddress = requiredAddress("NEURALRATE_VAULT_MODULE_ADDRESS");
  const module = await ethers.getContractAt("NeuralRateVaultModule", moduleAddress);

  // Build anchorSnapshot calldata
  const registryAbi = [
    "function anchorSnapshot(address vaultAddress, bytes32 snapshotHash, string calldata snapshotCid, string calldata descriptor)"
  ];
  const registryIface = new ethers.Interface(registryAbi);
  const anchorCalldata = registryIface.encodeFunctionData("anchorSnapshot", [
    vaultAddress,
    snapshotHash,
    "local-snapshot:" + snapshotHash,
    "strategy:strategy:mnt-native-transfer"
  ]);

  // Build executeVaultCall calldata
  const moduleAbi = [
    "function executeVaultCall(address ownerEoa, address vaultAddress, address targetContract, uint256 value, bytes calldata callData, bytes32 intentHash, bytes32 snapshotHash, uint256 slippageBps, uint256 deadline)"
  ];
  const moduleIface = new ethers.Interface(moduleAbi);
  const executeCalldata = moduleIface.encodeFunctionData("executeVaultCall", [
    ownerEoa,
    vaultAddress,
    targetContract,
    value,
    callData,
    intentHash,
    snapshotHash,
    slippageBps,
    deadline
  ]);

  // Safe 7579 interface
  const safe7579Abi = [
    "function execute(bytes32 mode, bytes calldata executionCalldata) external"
  ];
  // Single call mode
  const singleMode = "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Build single execution calldata for Call 0 (anchorSnapshot)
  // Packed as: 20 bytes target | 32 bytes value | callData
  const targetRegistryBytes = ethers.getBytes(registryAddress);
  const valueBytes = ethers.zeroPadValue(ethers.toBeArray(0), 32);
  const anchorCallDataBytes = ethers.getBytes(anchorCalldata);
  const singleCalldata0 = ethers.concat([targetRegistryBytes, valueBytes, anchorCallDataBytes]);

  // Build single execution calldata for Call 1 (executeVaultCall)
  const targetModuleBytes = ethers.getBytes(moduleAddress);
  const executeCallDataBytes = ethers.getBytes(executeCalldata);
  const singleCalldata1 = ethers.concat([targetModuleBytes, valueBytes, executeCallDataBytes]);

  // Impersonate the Entrypoint to execute on the Safe
  const entrypointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [entrypointAddress],
  });
  const entrypointSigner = await ethers.getSigner(entrypointAddress);

  await network.provider.send("hardhat_setBalance", [
    entrypointAddress,
    "0x10000000000000000000",
  ]);

  const safeWithEntrypoint = new ethers.Contract(vaultAddress, safe7579Abi, entrypointSigner);

  console.log("\n1. Simulating Call 0 (anchorSnapshot) as single call on Safe...");
  try {
    const tx = await safeWithEntrypoint.execute(singleMode, singleCalldata0);
    await tx.wait();
    console.log("Call 0 (anchorSnapshot) SUCCESS!");
  } catch (error: any) {
    console.error("Call 0 (anchorSnapshot) FAILED:");
    console.error(error.message || error);
  }

  console.log("\n3. Impersonating Safe vault and calling executeVaultCall directly on NeuralRateVaultModule...");
  // Impersonate Safe vault
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [vaultAddress],
  });
  const vaultSigner = await ethers.getSigner(vaultAddress);
  await network.provider.send("hardhat_setBalance", [
    vaultAddress,
    "0x10000000000000000000",
  ]);

  const moduleWithVault = module.connect(vaultSigner);

  try {
    const tx = await moduleWithVault.executeVaultCall(
      ownerEoa,
      vaultAddress,
      targetContract,
      value,
      callData,
      intentHash,
      snapshotHash,
      slippageBps,
      deadline
    );
    const receipt = await tx.wait();
    console.log("executeVaultCall SUCCESS! Gas used:", receipt?.gasUsed.toString());
  } catch (error: any) {
    console.error("executeVaultCall FAILED:");
    console.error(error.message || error);
  }
}

main().catch(console.error);
