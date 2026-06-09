import * as fs from "fs";
import * as path from "path";
import { ethers } from "hardhat";

async function main() {
  const dbPath = path.join(__dirname, "../../scripts/user-db-state.json");
  const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));

  const matches: any[] = [];

  function search(obj: any) {
    if (!obj || typeof obj !== "object") return;
    if (obj.failure_reason && obj.failure_reason.includes("0xacfdb444")) {
      matches.push(obj);
    }
    for (const key of Object.keys(obj)) {
      search(obj[key]);
    }
  }

  search(data);
  console.log(`Found ${matches.length} matching entries`);

  const safe7579Abi = [
    "function execute(bytes32 mode, bytes calldata executionCalldata) external"
  ];
  const iface = new ethers.Interface(safe7579Abi);

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    console.log(`\n--- Match ${i} ---`);
    console.log("Keys in match:", Object.keys(match));
    if (match.payload_json) {
      console.log("payload_json keys:", Object.keys(JSON.parse(match.payload_json)));
      const payload = JSON.parse(match.payload_json);
      if (payload.resolvedArgs) {
        console.log("resolvedArgs:", payload.resolvedArgs);
      }
    }
    
    // Extract callData from failure_reason
    const reason = match.failure_reason;
    const callDataRegex = /callData:\s+(0x[0-9a-fA-F]+)/;
    const regexMatch = reason.match(callDataRegex);
    if (regexMatch) {
      const callData = regexMatch[1];
      console.log("Extracted callData length (bytes):", (callData.length - 2) / 2);
      
      try {
        const parsed = iface.decodeFunctionData("execute", callData);
        console.log("Mode:", parsed[0]);
        console.log("ExecutionCalldata length (bytes):", (parsed[1].length - 2) / 2);

        const batchAbi = [
          "tuple(address target, uint256 value, bytes callData)[]"
        ];
        const decodedCalls = ethers.AbiCoder.defaultAbiCoder().decode(
          batchAbi,
          parsed[1]
        )[0];

        console.log("Decoded calls count:", decodedCalls.length);
        for (let j = 0; j < decodedCalls.length; j++) {
          const call = decodedCalls[j];
          console.log(`  Call ${j}:`);
          console.log("    Target:", call.target);
          console.log("    Value:", call.value.toString());
          console.log("    Calldata length (bytes):", (call.callData.length - 2) / 2);

          // Try decoding as executeVaultCall
          try {
            const vmAbi = [
              "function executeVaultCall(address ownerEoa, address vaultAddress, address targetContract, uint256 value, bytes calldata callData, bytes32 intentHash, bytes32 snapshotHash, uint256 slippageBps, uint256 deadline)"
            ];
            const vmInterface = new ethers.Interface(vmAbi);
            const vmParsed = vmInterface.decodeFunctionData("executeVaultCall", call.callData);
            console.log("      Decoded executeVaultCall:");
            console.log("        ownerEoa:", vmParsed.ownerEoa);
            console.log("        vaultAddress:", vmParsed.vaultAddress);
            console.log("        targetContract:", vmParsed.targetContract);
            console.log("        value:", vmParsed.value.toString());
            console.log("        intentHash:", vmParsed.intentHash);
            console.log("        snapshotHash:", vmParsed.snapshotHash);
            console.log("        slippageBps:", vmParsed.slippageBps.toString());
            console.log("        deadline:", vmParsed.deadline.toString());
          } catch (e: any) {
            console.log("      Could not decode as executeVaultCall:", e.message);
          }
        }
      } catch (err: any) {
        console.error("Failed to decode extracted callData:", err.message || err);
      }
    } else {
      console.log("Could not find callData in failure_reason");
    }
  }
}

main().catch(console.error);
