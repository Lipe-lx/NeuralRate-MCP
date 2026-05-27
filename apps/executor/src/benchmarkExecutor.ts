import { createPublicClient, encodeFunctionData, http, parseEventLogs, defineChain } from "viem";
import { type ManagedSigner } from "./managedSigner.js";
import { config } from "./config.js";
import { ensureAnchoredSnapshot, getActivePolicy } from "./onchainPolicy.js";

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
    name: "createDecisionReceipt",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ownerEoa", type: "address" },
      { name: "vaultAddress", type: "address" },
      { name: "delegate", type: "address" },
      { name: "externalDecisionId", type: "string" },
      { name: "policyVersion", type: "string" },
      { name: "strategyKey", type: "string" },
      { name: "snapshotHash", type: "bytes32" },
      { name: "snapshotCID", type: "string" },
      { name: "predictedApyBps", type: "int256" },
      { name: "settlementHorizonHours", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "DecisionReceiptCreated",
    inputs: [
      { indexed: true, name: "receiptId", type: "uint256" },
      { indexed: false, name: "externalDecisionId", type: "string" },
      { indexed: true, name: "vaultAddress", type: "address" },
      { indexed: true, name: "delegate", type: "address" },
      { indexed: false, name: "policyVersion", type: "string" },
      { indexed: false, name: "strategyKey", type: "string" },
      { indexed: false, name: "snapshotHash", type: "bytes32" },
      { indexed: false, name: "snapshotCID", type: "string" },
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
  ownerEoa: string;
  vaultAddress: string;
  delegate: string;
  externalDecisionId: string;
  policyVersion: string;
  strategyKey: string;
  snapshotHash: `0x${string}`;
  snapshotCID: string;
  predictedApyBps: number;
  settlementHorizonHours: number;
}) {
  return encodeFunctionData({
    abi: benchmarkAbi,
    functionName: "createDecisionReceipt",
    args: [
      args.ownerEoa as `0x${string}`,
      args.vaultAddress as `0x${string}`,
      args.delegate as `0x${string}`,
      args.externalDecisionId,
      args.policyVersion,
      args.strategyKey,
      args.snapshotHash,
      args.snapshotCID,
      BigInt(args.predictedApyBps),
      BigInt(args.settlementHorizonHours),
    ],
  });
}

export function extractDecisionCreated(logs: readonly unknown[]) {
  const parsedLogs = parseEventLogs({
    abi: benchmarkAbi,
    eventName: "DecisionReceiptCreated",
    logs: logs as any,
  });

  const match = parsedLogs.find((log) => log.address.toLowerCase() === config.benchmarkContract.toLowerCase());
  if (!match) {
    throw new Error("DecisionReceiptCreated event not found in benchmark receipt.");
  }

  return {
    onchainDecisionId: match.args.receiptId?.toString() ?? "",
    vaultAddress: String(match.args.vaultAddress ?? "").toLowerCase(),
  };
}

export async function executeBenchmarkJob(
  signer: ManagedSigner,
  payload: {
    ownerEoa: string;
    vaultAddress: string;
    decisionId: string;
    policyVersion: string;
    strategyKey: string;
    snapshotHash?: string | null;
    snapshotCid?: string | null;
    predictedApyBps: number;
    settlementHorizonHours: number;
  }
) {
  const capabilities = signer.getCapabilities();
  if (!capabilities.canExecute) {
    throw new Error("Signer cannot execute transactions");
  }

  const activePolicy = await getActivePolicy(payload.vaultAddress);
  if (!activePolicy) {
    throw new Error("No active on-chain policy for the target vault.");
  }

  const anchoredSnapshot = await ensureAnchoredSnapshot({
    signer,
    vaultAddress: payload.vaultAddress,
    snapshotHash: payload.snapshotHash,
    snapshotCid: payload.snapshotCid,
    descriptor: `benchmark:${payload.decisionId}`,
  });
  if (!anchoredSnapshot.snapshotHash) {
    throw new Error("Benchmark jobs require an anchored snapshot hash.");
  }

  const calldata = buildCreateDecisionCalldata({
    ownerEoa: payload.ownerEoa,
    vaultAddress: payload.vaultAddress,
    delegate: activePolicy.delegate,
    externalDecisionId: payload.decisionId,
    policyVersion: payload.policyVersion,
    strategyKey: payload.strategyKey,
    snapshotHash: anchoredSnapshot.snapshotHash as `0x${string}`,
    snapshotCID: payload.snapshotCid ?? payload.snapshotHash ?? "",
    predictedApyBps: payload.predictedApyBps,
    settlementHorizonHours: payload.settlementHorizonHours,
  });
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
