import type { Address, Hex } from "viem";

export const vaultModuleDeployment = {
  chainId: 5003,
  contractName: "NeuralRateVaultModule",
  address: "0xACBB78DAB5D1404C9eeC1E90BCe569cD1acc91bF" as Address,
  expectedBytecodeHash: "0x584c9850e175d9106bf285fbf57344d9a209ef2b161fc542891530f912efcdd4" as Hex,
  deploymentStatus: "pinned" as const,
  txHash: "0xeec210449b8b48c8745186e7c92ef8bac2cf1a7c4fe239141aa4b9c980eae031" as Hex,
  updatedAt: "2026-06-10T07:44:54.288Z",
};
