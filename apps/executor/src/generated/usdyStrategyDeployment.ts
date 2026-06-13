import type { Address, Hex } from "viem";

export const usdyStrategyDeployment = {
  chainId: 5003,
  contractName: "NeuralRateUsdYStrategyAdapter",
  address: "0xFeE16FAd13789e9bBA4779D025186341e58799a3" as Address,
  expectedBytecodeHash: "0xcab588924aa9de2f775dcb7154530a43fbcc81305dbcbc77e3b60c92f74cf705" as Hex,
  deploymentStatus: "pinned" as const,
  txHash: "0xee3a1caa73baaa8d3adcd103d44d9bf424b5612b660fc642bc40e11287a9e3c8" as Hex,
  updatedAt: "2026-05-25T19:08:46.398Z",
};
