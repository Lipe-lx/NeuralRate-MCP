const CREATE_DECISION_SELECTOR = "0xdce483dd";
const DECISION_CREATED_TOPIC = "0x8b8c19d15e0196ad4ddfc27a21715a842952d20358b81cb9bd0ead3faaa979c2";
const AGENT_SELECTOR = "0xf5ff5c76";

type JsonRpcSuccess<T> = {
  result: T;
};

type JsonRpcError = {
  error: {
    code: number;
    message: string;
  };
};

export type JsonRpcLog = {
  address: string;
  topics: string[];
  data: string;
};

export type JsonRpcReceipt = {
  status?: string;
  logs?: JsonRpcLog[];
};

const stripHexPrefix = (value: string) => value.replace(/^0x/i, "");

const padHex = (value: string, length = 64) => stripHexPrefix(value).padStart(length, "0");

const padRightHex = (value: string, length: number) => stripHexPrefix(value).padEnd(length, "0");

const bigintToHex = (value: bigint) => value.toString(16);

function encodeUint256(value: bigint) {
  if (value < 0n) throw new Error("Unsigned integer cannot be negative");
  return padHex(bigintToHex(value));
}

function encodeInt256(value: bigint) {
  const maxUint256 = 1n << 256n;
  const encoded = value < 0n ? maxUint256 + value : value;
  return padHex(bigintToHex(encoded));
}

function encodeAddress(address: string) {
  const normalized = stripHexPrefix(address).toLowerCase();
  if (normalized.length !== 40) throw new Error(`Invalid address: ${address}`);
  return padHex(normalized);
}

function encodeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const byteLength = encodeUint256(BigInt(bytes.length));
  const paddedLength = Math.ceil(hex.length / 64) * 64;
  return `${byteLength}${padRightHex(hex, paddedLength)}`;
}

export function buildCreateDecisionCalldata(args: {
  requestedBy: string;
  dataSnapshotHash: string;
  predictedApyBps: number;
  settlementHorizonHours: number;
}) {
  const dynamicOffset = 32n * 4n;
  const head = [
    encodeAddress(args.requestedBy),
    encodeUint256(dynamicOffset),
    encodeInt256(BigInt(args.predictedApyBps)),
    encodeUint256(BigInt(args.settlementHorizonHours)),
  ].join("");

  const tail = encodeString(args.dataSnapshotHash);

  return `${CREATE_DECISION_SELECTOR}${head}${tail}`;
}

export async function createDataSnapshotHash(payload: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}

async function rpcRequest<T>(rpcUrl: string, method: string, params: unknown[]) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as JsonRpcSuccess<T> | JsonRpcError;
  if ("error" in json) {
    throw new Error(json.error.message || "RPC request failed");
  }

  return json.result;
}

export async function readAuthorizedAgentAddress(rpcUrl: string, contractAddress: string) {
  const result = await rpcRequest<string>(rpcUrl, "eth_call", [
    {
      to: contractAddress,
      data: AGENT_SELECTOR,
    },
    "latest",
  ]);

  if (!result || result === "0x") {
    throw new Error("Unable to read benchmark agent");
  }

  return `0x${stripHexPrefix(result).slice(-40)}`.toLowerCase();
}

export async function waitForTransactionReceipt(
  rpcUrl: string,
  txHash: string,
  options: { intervalMs?: number; maxAttempts?: number } = {}
) {
  const { intervalMs = 1500, maxAttempts = 30 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const receipt = await rpcRequest<JsonRpcReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      return receipt;
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return null;
}

export function extractOnchainDecisionId(receipt: JsonRpcReceipt, benchmarkContract: string) {
  const contract = benchmarkContract.toLowerCase();
  const log = receipt.logs?.find(
    (entry) => entry.address.toLowerCase() === contract && entry.topics?.[0] === DECISION_CREATED_TOPIC
  );

  if (!log?.topics?.[1]) {
    return null;
  }

  return BigInt(log.topics[1]).toString();
}
