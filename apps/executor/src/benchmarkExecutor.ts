import { createPublicClient, encodeFunctionData, http, parseEventLogs, defineChain } from "viem";
import { type ManagedSigner } from "./managedSigner.js";
import { config } from "./config.js";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [config.mantleSepoliaRpcUrl] },
  },
});

const benchmarkAbi = [
  {
    type: "function",
    name: "createDecision",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_requestedBy", type: "address" },
      { name: "_dataSnapshotHash", type: "string" },
      { name: "_predictedApyBps", type: "int256" },
      { name: "_settlementHorizonHours", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "DecisionCreated",
    inputs: [
      { indexed: true, name: "decisionId", type: "uint256" },
      { indexed: true, name: "requestedBy", type: "address" },
      { indexed: false, name: "dataSnapshotHash", type: "string" },
      { indexed: false, name: "predictedApyBps", type: "int256" },
      { indexed: false, name: "settlementHorizonHours", type: "uint256" },
    ],
  },
] as const;

const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(config.mantleSepoliaRpcUrl),
});

export function buildCreateDecisionCalldata(args: {
  requestedBy: string;
  dataSnapshotHash: string;
  predictedApyBps: number;
  settlementHorizonHours: number;
}) {
  return encodeFunctionData({
    abi: benchmarkAbi,
    functionName: "createDecision",
    args: [
      args.requestedBy as `0x${string}`,
      args.dataSnapshotHash,
      BigInt(args.predictedApyBps),
      BigInt(args.settlementHorizonHours),
    ],
  });
}

export function extractDecisionCreated(logs: readonly unknown[]) {
  const parsedLogs = parseEventLogs({
    abi: benchmarkAbi,
    eventName: "DecisionCreated",
    logs: logs as any,
  });

  const match = parsedLogs.find((log) => log.address.toLowerCase() === config.benchmarkContract.toLowerCase());
  if (!match) {
    throw new Error("DecisionCreated event not found in benchmark receipt.");
  }

  return {
    onchainDecisionId: match.args.decisionId?.toString() ?? "",
    requestedBy: String(match.args.requestedBy ?? "").toLowerCase(),
  };
}

export async function executeBenchmarkJob(
  signer: ManagedSigner,
  payload: {
    requestedBy: string;
    dataSnapshotHash: string;
    predictedApyBps: number;
    settlementHorizonHours: number;
  }
) {
  const capabilities = signer.getCapabilities();
  if (!capabilities.canExecute) {
    throw new Error("Signer cannot execute transactions");
  }

  const calldata = buildCreateDecisionCalldata(payload);
  const txHash = await signer.signAndSendTransaction({
    to: config.benchmarkContract,
    data: calldata,
    chainId: 5003,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  });
  const event = extractDecisionCreated(receipt.logs);
  const block = await publicClient.getBlock({
    blockHash: receipt.blockHash,
  });

  return {
    txHash,
    onchainDecisionId: event.onchainDecisionId,
    confirmedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
  };
}
