import { ethers } from "ethers";

function main() {
  const callData = "0xe9ae5c53010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000460000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000024000000000000000000000000086cd4f8c2528e71a473ed342aa73b8a00de906a4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000164dd909eaa00000000000000000000000094df9577f3ad55bc5c106a6e631bb2f3381f4ace1dce18d8fd81bd45787db4a3bf256ce4429e06a4509c0714c8bf7506e5a139130000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000516c6f63616c2d736e617073686f743a307833666433356638306332376262383265663938643635666338393965383238363939643333333434623662613561343936376463363239383733353566376431000000000000000000000000000000000000000000000000000000000000000000000000000000002573747261746567793a73747261746567793a6d6e742d6e61746976652d7472616e7366657200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f7061501a464e893636a5bf8eb4ab7ba2819154d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001445a6c362a000000000000000000000000053ddf34340b4f36f6ff71e723193e8321b6f39300000000000000000000000094df9577f3ad55bc5c106a6e631bb2f3381f4ace000000000000000000000000053ddf34340b4f36f6ff71e723193e8321b6f3930000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000000000000000012057db9d1b177b81eeb7c1b5f86cf8b57d995e71100f8b98f9aedd2de54c85e9893fd35f80c27bb82ef98d65fc899e828699d33344b6ba5a4967dc62987355f7d10000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006a291cd000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  const safe7579Abi = [
    "function execute(bytes32 mode, bytes calldata executionCalldata) external"
  ];
  const iface = new ethers.Interface(safe7579Abi);
  
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
    console.log(`\n  Call ${j}:`);
    console.log("    Target:", call.target);
    console.log("    Value:", call.value.toString());
    console.log("    Calldata length (bytes):", (call.callData.length - 2) / 2);

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
    } catch (e: any) {
      console.log("      Could not decode as anchorSnapshot:", e.message);
    }

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
}

main();
