import { type ManagedSigner } from "./managedSigner.js";
import { config } from "./config.js";

const CREATE_DECISION_SELECTOR = "0xdce483dd";

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
    data: "0x" + calldata.replace(/^0x/, ""),
    chainId: 5003,
  });

  return txHash;
}
