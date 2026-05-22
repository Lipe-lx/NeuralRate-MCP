import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const IDENTITY_REGISTRY = process.env.ERC8004_IDENTITY_REGISTRY_TESTNET;
  if (!IDENTITY_REGISTRY) {
    throw new Error("Missing ERC8004_IDENTITY_REGISTRY_TESTNET in .env");
  }

  // In a real scenario, this URI points to the IPFS CID of the agent-card.json
  const agentURI = "ipfs://QmPlaceholderAgentCard";

  console.log("Registering agent to ERC-8004 Identity Registry at:", IDENTITY_REGISTRY);

  const [signer] = await ethers.getSigners();
  console.log("Using deployer address:", signer.address);

  const ABI = [
    "function register(string calldata agentURI) external returns (uint256)",
    "event AgentRegistered(uint256 agentId, address owner)"
  ];

  const registry = new ethers.Contract(IDENTITY_REGISTRY, ABI, signer);

  console.log("Sending transaction...");
  const tx = await registry.register(agentURI);
  console.log("Transaction hash:", tx.hash);
  
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();

  // Find AgentRegistered event
  const event = receipt?.logs.find((log: any) => {
    try {
      return registry.interface.parseLog(log)?.name === "AgentRegistered";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = registry.interface.parseLog(event as any);
    console.log(`\n✅ Agent successfully registered!`);
    console.log(`Agent ID: ${parsed?.args[0].toString()}`);
    console.log(`Owner: ${parsed?.args[1]}`);
    console.log(`\nUpdate your .env ERC8004_AGENT_ID with this Agent ID`);
  } else {
    console.log("Registration complete, but AgentRegistered event not found in receipt.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
