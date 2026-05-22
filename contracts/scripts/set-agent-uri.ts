import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const IDENTITY_REGISTRY = process.env.ERC8004_IDENTITY_REGISTRY_TESTNET;
  const AGENT_ID = process.env.ERC8004_AGENT_ID;
  if (!IDENTITY_REGISTRY || !AGENT_ID) {
    throw new Error("Missing ERC8004_IDENTITY_REGISTRY_TESTNET or ERC8004_AGENT_ID in .env");
  }

  const agentURI = "ipfs://QmNopELMAq1iiyXXWuktDat34w4tFjbK7HHwFNcs2NZvpV";

  console.log(`Setting Agent URI for Agent ID ${AGENT_ID} at Registry ${IDENTITY_REGISTRY}`);

  const [signer] = await ethers.getSigners();
  console.log("Using deployer address:", signer.address);

  const ABI = [
    "function setAgentURI(uint256 agentId, string calldata newURI) external"
  ];

  const registry = new ethers.Contract(IDENTITY_REGISTRY, ABI, signer);

  console.log("Sending transaction...");
  try {
    const tx = await registry.setAgentURI(AGENT_ID, agentURI);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    await tx.wait();
    console.log("\n✅ Agent URI successfully updated!");
  } catch (error) {
    console.log("Failed to set Agent URI (possibly because the contract does not implement setAgentURI or requires different permissions).");
    console.error(error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
