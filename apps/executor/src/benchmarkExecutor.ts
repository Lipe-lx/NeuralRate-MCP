import { encodeFunctionData, formatEther, parseEventLogs, type Address, type Hex } from "viem";
import { type ManagedSigner } from "./managedSigner.js";
import { ensureAnchoredSnapshot, getActivePolicy } from "./onchainPolicy.js";
import { getExecutorRuntime } from "./runtime.js";
import { compactExecutorError } from "./errors.js";

const benchmarkAbi = [
  {
    type: "function",
    name: "receiptWriter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
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

const sameAddress = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());

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
  const {
    config,
  } = getExecutorRuntime();
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

async function assertBenchmarkSignerReady(signer: ManagedSigner) {
  const { config, publicClient } = getExecutorRuntime();
  const signerAddress = (await signer.getPublicAddress()).toLowerCase();

  const receiptWriter = String(await publicClient.readContract({
    address: config.benchmarkContract as Address,
    abi: benchmarkAbi,
    functionName: "receiptWriter",
  })).toLowerCase();

  if (!sameAddress(signerAddress, receiptWriter)) {
    throw new Error(
      `Managed benchmark signer ${signerAddress} is not the registry receiptWriter ${receiptWriter}.`
    );
  }

  const balance = await publicClient.getBalance({ address: signerAddress as Address });
  if (balance <= 0n) {
    throw new Error(`Managed benchmark signer ${signerAddress} has no native MNT for direct receipt gas.`);
  }

  return { signerAddress, balance };
}

async function assertDirectGasAffordable(args: {
  account: string;
  balance: bigint;
  to: string;
  data: string;
  label: string;
}) {
  const { publicClient } = getExecutorRuntime();
  try {
    const [gas, gasPrice] = await Promise.all([
      publicClient.estimateGas({
        account: args.account as Address,
        to: args.to as Address,
        data: args.data as Hex,
      }),
      publicClient.getGasPrice(),
    ]);
    const estimatedCost = gas * gasPrice;
    if (args.balance < estimatedCost) {
      throw new Error(
        `${args.label} needs about ${formatEther(estimatedCost)} MNT for gas, but signer balance is ${formatEther(args.balance)} MNT.`
      );
    }
  } catch (error) {
    throw new Error(compactExecutorError(error, `${args.label} preflight failed`));
  }
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
  const { config, publicClient } = getExecutorRuntime();
  const capabilities = signer.getCapabilities();
  if (!capabilities.canExecute) {
    throw new Error("Signer cannot execute transactions");
  }

  const signerReadiness = await assertBenchmarkSignerReady(signer);
  const activePolicy = await getActivePolicy(payload.vaultAddress);
  if (!activePolicy) {
    throw new Error("No active on-chain policy for the target vault.");
  }
  if (
    ![activePolicy.ownerEoa, activePolicy.delegate, activePolicy.vaultAddress].some((anchor) =>
      sameAddress(anchor, signerReadiness.signerAddress)
    )
  ) {
    throw new Error(
      `Snapshot anchoring requires the managed signer ${signerReadiness.signerAddress} to match the active policy owner, delegate, or vault.`
    );
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
  await assertDirectGasAffordable({
    account: signerReadiness.signerAddress,
    balance: signerReadiness.balance,
    to: config.benchmarkContract,
    data: calldata,
    label: "Benchmark receipt",
  });
  const txHash = await signer.signAndSendTransaction({
    to: config.benchmarkContract,
    data: calldata,
    chainId: config.chainId,
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
