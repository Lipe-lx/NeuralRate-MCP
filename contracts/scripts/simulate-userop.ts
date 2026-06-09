import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0x86cD4f8c2528E71a473ED342aa73B8a00de906a4";
  const vaultAddress = "0x9ddbbb5f9a3cc1c0e744d20ba6b0fa50fb22a3ff";
  const moduleAddress = "0xf7061501a464e893636a5BF8eB4ab7Ba2819154D";
  const guardAddress = "0x666Bc822156824F40F2b70aAaAcBfe87467D79A5";

  const ownerEoa = "0x54FCb49Cd7281140e17721f65f00e49a809400Bc";
  const targetContract = ownerEoa;
  const value = ethers.parseUnits("0.001", 18);
  const callData = "0x";
  const intentHash = "0xc39865570b2f2a5b09efa73cb2141e8acc865069ad4d9618359892419e99df68";
  const snapshotHash = "0x194f5450d527aa775a836de57b41d447bb57d70aaac0b5fe8cf04320ac90230a";
  const slippageBps = 0;
  
  // Get latest block timestamp from network
  const latestBlock = await ethers.provider.getBlock("latest");
  const latestTimestamp = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
  console.log("Latest block timestamp on network:", latestTimestamp);
  
  const deadline = latestTimestamp + 3600; // 1 hour in the future relative to block timestamp
  console.log("Using simulated deadline:", deadline);

  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);
  
  console.log("\nSimulating anchorSnapshot call...");
  try {
    const anchorTx = await registry.anchorSnapshot.populateTransaction(
      vaultAddress,
      snapshotHash,
      "inline:194f5450d527aa77",
      "strategy:mnt-native-transfer"
    );
    
    const response = await ethers.provider.call({
      to: registryAddress,
      from: vaultAddress, // msg.sender override
      data: anchorTx.data
    });
    console.log("anchorSnapshot raw call response:", response);
    console.log("anchorSnapshot simulation: SUCCESS");
  } catch (error: any) {
    console.error("anchorSnapshot simulation failed:", error.message || error);
  }

  // Next, simulate validateAndConsumeExecution:
  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);
  console.log("\nSimulating validateAndConsumeExecution call...");
  try {
    const validateTx = await guard.validateAndConsumeExecution.populateTransaction(
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

    const response = await ethers.provider.call({
      to: guardAddress,
      from: moduleAddress, // msg.sender must be trustedModule
      data: validateTx.data
    });
    console.log("validateAndConsumeExecution raw call response:", response);
    console.log("validateAndConsumeExecution simulation: SUCCESS");
  } catch (error: any) {
    console.error("validateAndConsumeExecution simulation failed:", error.message || error);
  }
}

main().catch(console.error);
