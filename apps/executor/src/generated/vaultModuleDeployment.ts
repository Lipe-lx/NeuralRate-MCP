import type { Address, Hex } from "viem";

export const vaultModuleDeployment = {
  chainId: 5003,
  contractName: "NeuralRateVaultModule",
  address: "0xDAbB583bDE28241F1e3C61B423CF456D07f4DA11" as Address,
  expectedBytecodeHash: "0xef57485fd8087359a771f308469211fcb6b866c4e0f2961495835a34565b5a93" as Hex,
  deploymentStatus: "pinned" as const,
  txHash: "0x363de6d6b9153986eb3eddb5089849c5943fc1c1a49b85f4e361f34a5976f556" as Hex,
  updatedAt: "2026-05-26T00:22:51.596Z",
};
