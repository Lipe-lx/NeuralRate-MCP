import { ethers } from "hardhat";

async function main() {
  const registryAddress = "0xc4580b5831f36eCc3E4865e635c970C75DD9869C";
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
  const deadline = 1780958841;

  // Let's connect as the Safe itself (impersonating the Safe)
  // We can use hardhat's getSigners or a provider call.
  // Wait, let's just do a staticCall to see where it reverts.
  // First, check anchorSnapshot static call:
  const registry = await ethers.getContractAt("NeuralRatePolicyRegistry", registryAddress);
  
  console.log("Simulating anchorSnapshot call...");
  try {
    // We can use callStatic / staticCall and override msg.sender using ethers provider or impersonating
    // Let's run impersonateAccount in hardhat
    await ethers.provider.send("hardhat_impersonateAccount", [vaultAddress]);
    const safeSigner = await ethers.getSigner(vaultAddress);
    
    // Send some gas money to the Safe if it doesn't have ETH on local network (but we are on mantleSepolia fork / live)
    // Wait, on live network we cannot impersonate unless we run a local fork.
    // Let's check if we are on local hardhat network or live mantleSepolia.
    // If we are on live mantleSepolia, we cannot impersonate, but we can do a raw eth_call with "from" override!
    // Ethers v6 allows overriding "from" in staticCall.
    const anchorTx = await registry.anchorSnapshot.populateTransaction(
      vaultAddress,
      snapshotHash,
      "inline:194f5450d527aa77",
      "strategy:mnt-native-transfer"
    );
    
    const response = await ethers.provider.call({
      to: registryAddress,
      from: vaultAddress,
      data: anchorTx.data
    });
    console.log("anchorSnapshot raw call response:", response);
    console.log("anchorSnapshot simulation: SUCCESS");
  } catch (error: any) {
    console.error("anchorSnapshot simulation failed:", error.message || error);
  }

  // Next, simulate validateAndConsumeExecution:
  const guard = await ethers.getContractAt("NeuralRateExecutionGuard", guardAddress);
  console.log("Simulating validateAndConsumeExecution call...");
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
