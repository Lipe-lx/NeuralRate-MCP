import { ethers, network } from "hardhat";

async function main() {
  if (network.name !== "hardhat") {
    console.log("This simulation must be run on the local 'hardhat' network with forking enabled.");
    console.log("Please run with: npx hardhat run scripts/simulate-userop.ts --network hardhat");
    return;
  }

  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0xd9afd65e5361d9a098e0fe30b914883f7c82f743";
  const moduleAddress = "0xf7061501a464e893636a5BF8eB4ab7Ba2819154D";
  const guardAddress = "0x666Bc822156824F40F2b70aAaAcBfe87467D79A5";

  const ownerEoa = "0xac82ef541d55637eb749bb9123e0244668ca0990";
  const delegateAddress = "0xc57130F28f3d670cA75AD9a78784966B767E55e3";
  const targetContract = ownerEoa;
  const value = ethers.parseUnits("1", 18);
  const callData = "0x";
  const intentHash = "0x0bc85f27fc7177729a61e2d8277a0996c0a6dbb1fd5f3d66d0ad236d20f42665";
  const snapshotHash = "0x08ef47c944e410b1d381d06db778ae2a9072736eef6db2011bfe4a9ae7c22d0b";
  const slippageBps = 0;
  
  const latestBlock = await ethers.provider.getBlock("latest");
  const latestTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
  const deadline = latestTimestamp + 3600;

  console.log("Forking Mantle Sepolia at block:", latestBlock?.number);

  // Impersonate the owner EOA to publish the scaled policy
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [ownerEoa],
  });
  const ownerSigner = await ethers.getSigner(ownerEoa);

  // Give owner some ETH/gas
  await network.provider.send("hardhat_setBalance", [
    ownerEoa,
    "0x10000000000000000000",
  ]);

  const registryWithOwner = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress, ownerSigner);

  console.log("\n1. Publishing scaled policy as owner...");
  const validAfter = latestTimestamp - 3600;
  const validUntil = latestTimestamp + 3600 * 24 * 30;
  const maxPerUseScaled = ethers.parseUnits("1000", 18); // $1000 scaled by 1e18
  const maxDailyScaled = ethers.parseUnits("2500", 18);
  const maxTotalScaled = ethers.parseUnits("10000", 18);
  const maxSlippageBps = 50;
  const requireSnapshot = true;
  const policyVersion = "vault-v1";
  const allowedAssets = ["MNT", "USDY"];
  const allowedProtocols = ["neuralrate-vault-module"];
  const allowedTargets: string[] = [];
  const allowedSelectors = ["0x00000000", "0xa9059cbb", "0x095ea7b3"];

  try {
    const tx = await registryWithOwner.publishPolicy(
      ownerEoa,
      vaultAddress,
      delegateAddress,
      maxPerUseScaled,
      maxDailyScaled,
      maxTotalScaled,
      validAfter,
      validUntil,
      maxSlippageBps,
      requireSnapshot,
      policyVersion,
      allowedAssets,
      allowedProtocols,
      allowedTargets,
      allowedSelectors
    );
    await tx.wait();
    console.log("Policy published! Tx:", tx.hash);

    const activePolicy = await registryWithOwner.getActivePolicy(vaultAddress);
    console.log("On-chain policy maxPerUse:", activePolicy.maxPerUse.toString());
  } catch (error: any) {
    console.error("Publish policy failed:", error.message || error);
    return;
  }

  // Impersonate the Safe vault address to anchor the snapshot
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [vaultAddress],
  });
  const vaultSigner = await ethers.getSigner(vaultAddress);

  // Give vault some ETH/gas
  await network.provider.send("hardhat_setBalance", [
    vaultAddress,
    "0x10000000000000000000",
  ]);

  const registryWithVault = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress, vaultSigner);
  
  console.log("\n2. Sending anchorSnapshot transaction on local fork...");
  try {
    const tx = await registryWithVault.anchorSnapshot(
      vaultAddress,
      snapshotHash,
      "inline:194f5450d527aa77",
      "strategy:mnt-native-transfer"
    );
    await tx.wait();
    console.log("anchorSnapshot TX confirmed! Hash:", tx.hash);
  } catch (error: any) {
    console.error("anchorSnapshot failed:", error.message || error);
    return;
  }

  // Impersonate the trusted module to call validateAndConsumeExecution
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [moduleAddress],
  });
  const moduleSigner = await ethers.getSigner(moduleAddress);

  await network.provider.send("hardhat_setBalance", [
    moduleAddress,
    "0x10000000000000000000",
  ]);

  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress, moduleSigner);

  console.log("\n3. Simulating validateAndConsumeExecution with executor = vaultAddress...");
  try {
    const tx = await guard.validateAndConsumeExecution(
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
    console.log("validateAndConsumeExecution SUCCESS!");
  } catch (error: any) {
    console.error("validateAndConsumeExecution failed:", error.message || error);
  }

  console.log("\n4. Simulating validateAndConsumeExecution with executor = ownerEoa (mismatch case)...");
  try {
    await guard.validateAndConsumeExecution(
      ownerEoa,
      vaultAddress,
      ownerEoa, // executor (mismatch)
      targetContract,
      value,
      callData,
      intentHash,
      snapshotHash,
      slippageBps,
      deadline
    );
    console.log("validateAndConsumeExecution SUCCESS! (Unexpected)");
  } catch (error: any) {
    console.log("validateAndConsumeExecution failed as expected:", error.message || error);
  }
}

main().catch(console.error);
