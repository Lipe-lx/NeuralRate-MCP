import type { Address, Hex } from "viem";

export const vaultModuleDeployment = {
  chainId: 5003,
  contractName: "NeuralRateVaultModule",
  address: "0xf7061501a464e893636a5BF8eB4ab7Ba2819154D" as Address,
  expectedBytecodeHash: "0x4593e9983064e13c9df55fd5b8c378c802ebcd67b9cc0789a6e5d1fe508e32e9" as Hex,
  deploymentStatus: "pinned" as const,
  txHash: "0x03c98faf3de94e2eafa0c75ca715b5bcebea38462a3fcc6fd077f6965ee243d5" as Hex,
  updatedAt: "2026-05-27T06:01:57.898Z",
};
