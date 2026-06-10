import { ethers } from "hardhat";

async function main() {
  const callData = "0xe9ae5c53010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000460000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000024000000000000000000000000086cd4f8c2528e71a473ed342aa73b8a00de906a4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000164dd909eaa000000000000000000000000d9afd65e5361d9a098e0fe30b914883f7c82f743e256d3e28e666420c9f359a0c4995d70129c6c187e7d6a6eecd25f3a740a07ea0000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000516c6f63616c2d736e617073686f743a307865323536643365323865363636343230633966333539613063343939356437303132396336633138376537643661366565636432356633613734306130376561000000000000000000000000000000000000000000000000000000000000000000000000000000002573747261746567793a73747261746567793a6d6e742d6e61746976652d7472616e7366657200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f7061501a464e893636a5bf8eb4ab7ba2819154d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001445a6c362a000000000000000000000000ac82ef541d55637eb749bb9123e0244668ca0990000000000000000000000000d9afd65e5361d9a098e0fe30b914883f7c82f743000000000000000000000000ac82ef541d55637eb749bb9123e0244668ca09900000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000000000120378b2ac9cefdf4bc76f2c085476f22697018bed06b654098a5b2017e426b881fe256d3e28e666420c9f359a0c4995d70129c6c187e7d6a6eecd25f3a740a07ea0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006a28d4f8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  const safe7579Abi = [
    "function execute(bytes32 mode, bytes calldata executionCalldata) external"
  ];
  const iface = new ethers.Interface(safe7579Abi);

  try {
    const parsed = iface.decodeFunctionData("execute", callData);
    console.log("Mode:", parsed[0]);

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
        // Try decoding as anchorSnapshot
        try {
          const regAbi = [
            "function anchorSnapshot(address vaultAddress, bytes32 snapshotHash, string calldata snapshotCid, string calldata descriptor)"
          ];
          const regInterface = new ethers.Interface(regAbi);
          const regParsed = regInterface.decodeFunctionData("anchorSnapshot", call.callData);
          console.log("      Decoded anchorSnapshot:");
          console.log("        vaultAddress:", regParsed.vaultAddress);
          console.log("        snapshotHash:", regParsed.snapshotHash);
          console.log("        snapshotCid:", regParsed.snapshotCid);
          console.log("        descriptor:", regParsed.descriptor);
        } catch (err: any) {
          console.log("      Could not decode:", err.message);
        }
      }
    }
  } catch (err: any) {
    console.error("Failed to decode callData:", err.message || err);
  }
}

main().catch(console.error);
