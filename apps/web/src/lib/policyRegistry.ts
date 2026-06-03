import { encodeFunctionData, keccak256, stringToHex, type EIP1193Provider } from "viem";
import {
  DEMO_TARGET_ASSET,
  NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS,
  NEURALRATE_POLICY_REGISTRY_CONTRACT,
} from "../config";

type WalletAccess = {
  getEthereumProvider: () => Promise<EIP1193Provider>;
};

export type PreparedTxRequest = {
  from: string;
  to: string;
  data: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
};

const policyRegistryAbi = [
  {
    type: "function",
    name: "publishPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ownerEoa", type: "address" },
      { name: "vaultAddress", type: "address" },
      { name: "delegate", type: "address" },
      { name: "maxPerUse", type: "uint256" },
      { name: "maxDaily", type: "uint256" },
      { name: "maxTotal", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "maxSlippageBps", type: "uint256" },
      { name: "requireSnapshot", type: "bool" },
      { name: "policyVersion", type: "string" },
      { name: "allowedAssets", type: "string[]" },
      { name: "allowedProtocols", type: "string[]" },
      { name: "allowedTargets", type: "address[]" },
      { name: "allowedSelectors", type: "bytes4[]" },
    ],
    outputs: [{ name: "policyId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "revokeActivePolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ownerEoa", type: "address" },
      { name: "vaultAddress", type: "address" },
    ],
    outputs: [],
  },
] as const;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const UNKNOWN_BLOCK_RETRY_DELAYS_MS = [800, 1500, 2500, 4000] as const;
const POST_RECEIPT_PROPAGATION_DELAY_MS = 900;

const isUnknownBlockError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    message?: unknown;
    details?: unknown;
    shortMessage?: unknown;
    cause?: { message?: unknown; details?: unknown } | null;
  };

  const parts = [
    record.message,
    record.details,
    record.shortMessage,
    record.cause?.message,
    record.cause?.details,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");

  return /unknown block/i.test(parts);
};

const retryOnUnknownBlock = async <T>(action: () => Promise<T>) => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= UNKNOWN_BLOCK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (!isUnknownBlockError(error) || attempt === UNKNOWN_BLOCK_RETRY_DELAYS_MS.length) {
        throw error;
      }

      await wait(UNKNOWN_BLOCK_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
};

const waitForTransactionReceipt = async (
  provider: EIP1193Provider,
  txHash: string,
  attempts = 40,
  delayMs = 1500
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let receipt = null;
    try {
      receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
    } catch (error) {
      if (!isUnknownBlockError(error)) {
        throw error;
      }
    }

    if (receipt) {
      await wait(POST_RECEIPT_PROPAGATION_DELAY_MS);
      return receipt;
    }

    await wait(delayMs);
  }

  throw new Error(`Transaction ${txHash} was not confirmed in time.`);
};

const normalizeList = (values: string[]) => values.map((value) => value.trim()).filter(Boolean);

const defaultAllowedSelectors = () => {
  if (DEMO_TARGET_ASSET.toUpperCase() === "MNT") {
    return ["0x00000000"];
  }
  return ["0xa9059cbb"];
};

export async function publishActivePolicy(args: {
  ownerEoa: string;
  vaultAddress: string;
  wallet: WalletAccess;
  policyVersion: string;
  allowedAssets: string[];
  allowedProtocols: string[];
  maxPerUse: number;
  maxDaily: number;
  maxTotal: number;
  maxSlippageBps: number;
  validForSeconds?: number;
  requireSnapshot?: boolean;
}) {
  if (!NEURALRATE_POLICY_REGISTRY_CONTRACT) {
    return null;
  }

  if (!NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS || /^0x0{40}$/i.test(NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS)) {
    throw new Error("Configure VITE_PUBLIC_NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS before publishing the on-chain policy.");
  }

  const provider = await args.wallet.getEthereumProvider();
  const now = Math.floor(Date.now() / 1000);
  const validUntil = now + (args.validForSeconds ?? 12 * 60 * 60);
  const data = encodeFunctionData({
    abi: policyRegistryAbi,
    functionName: "publishPolicy",
    args: [
      args.ownerEoa as `0x${string}`,
      args.vaultAddress as `0x${string}`,
      NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS as `0x${string}`,
      BigInt(Math.max(0, Math.trunc(args.maxPerUse))),
      BigInt(Math.max(0, Math.trunc(args.maxDaily))),
      BigInt(Math.max(0, Math.trunc(args.maxTotal))),
      BigInt(now),
      BigInt(validUntil),
      BigInt(Math.max(0, Math.trunc(args.maxSlippageBps))),
      args.requireSnapshot ?? true,
      args.policyVersion,
      normalizeList(args.allowedAssets),
      normalizeList(args.allowedProtocols),
      [] as `0x${string}`[],
      defaultAllowedSelectors() as `0x${string}`[],
    ],
  });

  const txHash = await retryOnUnknownBlock(() =>
    provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: args.ownerEoa,
        to: NEURALRATE_POLICY_REGISTRY_CONTRACT,
        data,
        value: "0x0",
      }],
    })
  );

  await waitForTransactionReceipt(provider, String(txHash));
  return String(txHash);
}

export async function revokeActivePolicy(args: {
  ownerEoa: string;
  vaultAddress: string;
  wallet: WalletAccess;
}) {
  if (!NEURALRATE_POLICY_REGISTRY_CONTRACT) {
    return null;
  }

  const provider = await args.wallet.getEthereumProvider();
  const data = encodeFunctionData({
    abi: policyRegistryAbi,
    functionName: "revokeActivePolicy",
    args: [
      args.ownerEoa as `0x${string}`,
      args.vaultAddress as `0x${string}`,
    ],
  });

  const txHash = await retryOnUnknownBlock(() =>
    provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: args.ownerEoa,
        to: NEURALRATE_POLICY_REGISTRY_CONTRACT,
        data,
        value: "0x0",
      }],
    })
  );

  await waitForTransactionReceipt(provider, String(txHash));
  return String(txHash);
}

export async function sendPreparedTransaction(args: {
  wallet: WalletAccess;
  txRequest: PreparedTxRequest;
}) {
  const provider = await args.wallet.getEthereumProvider();
  const txHash = await retryOnUnknownBlock(() =>
    provider.request({
      method: "eth_sendTransaction",
      params: [{
        from: args.txRequest.from,
        to: args.txRequest.to,
        data: args.txRequest.data,
        value: args.txRequest.value ?? "0x0",
        gas: args.txRequest.gas,
        gasPrice: args.txRequest.gasPrice,
        maxFeePerGas: args.txRequest.maxFeePerGas,
        maxPriorityFeePerGas: args.txRequest.maxPriorityFeePerGas,
      }],
    })
  );

  await waitForTransactionReceipt(provider, String(txHash));
  return String(txHash);
}

export const buildLocalSnapshotHash = (payload: unknown) =>
  keccak256(stringToHex(JSON.stringify(payload)));
