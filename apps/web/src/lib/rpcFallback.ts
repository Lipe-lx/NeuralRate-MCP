import type { EIP1193Provider } from "viem";
import { MANTLE_RPC_FALLBACK_URLS } from "../config";

type JsonRpcPayload = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcResponse<T> = {
  result?: T;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

const READ_ONLY_RPC_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionCount",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "net_version",
  "web3_clientVersion",
]);

export const describeRpcError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "";
  }

  const record = error as {
    message?: unknown;
    details?: unknown;
    shortMessage?: unknown;
    data?: unknown;
    cause?: { message?: unknown; details?: unknown; shortMessage?: unknown; data?: unknown } | null;
  };

  return [
    record.message,
    record.details,
    record.shortMessage,
    typeof record.data === "string" ? record.data : null,
    record.cause?.message,
    record.cause?.details,
    record.cause?.shortMessage,
    typeof record.cause?.data === "string" ? record.cause.data : null,
  ]
    .filter((value) => typeof value === "string")
    .join(" ");
};

export const isRecoverableReadRpcError = (error: unknown) =>
  /unknown block|rate limit|too many requests|quota|limit exceeded|upgrade your tier|paid one|timeout|failed to fetch|network error|rpc request failed|429/i
    .test(describeRpcError(error));

export const rpcRequestWithFallback = async <T>(
  method: string,
  params: unknown[] = [],
  urls = MANTLE_RPC_FALLBACK_URLS,
) => {
  let lastError: unknown;

  for (const url of urls) {
    try {
      const payload: JsonRpcPayload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`RPC ${response.status} ${response.statusText}`);
      }

      const json = await response.json() as JsonRpcResponse<T>;
      if (json.error) {
        throw new Error(json.error.message || `RPC error ${json.error.code ?? "unknown"}`);
      }

      return json.result as T;
    } catch (error) {
      lastError = error;
      if (!isRecoverableReadRpcError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "RPC request failed"));
};

export const withReadRpcFallback = (provider: EIP1193Provider): EIP1193Provider => ({
  ...provider,
  request: async (args) => {
    try {
      return await provider.request(args);
    } catch (error) {
      if (!READ_ONLY_RPC_METHODS.has(args.method) || !isRecoverableReadRpcError(error)) {
        throw error;
      }

      return rpcRequestWithFallback(args.method, Array.isArray(args.params) ? args.params : []);
    }
  },
});
