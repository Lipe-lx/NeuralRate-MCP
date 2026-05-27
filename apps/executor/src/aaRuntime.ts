import {
  createPublicClient,
  defineChain,
  encodeAbiParameters,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
} from "viem";
import {
  createBundlerClient,
  entryPoint07Abi,
  getUserOperationHash,
  toSmartAccount,
  type UserOperation,
} from "viem/account-abstraction";
import { config } from "./config.js";
import type { ManagedSigner } from "./managedSigner.js";

const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [config.mantleSepoliaRpcUrl] },
  },
});

const safe7579Abi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "mode", type: "bytes32" },
      { name: "executionCalldata", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getNonce",
    stateMutability: "view",
    inputs: [
      { name: "safe", type: "address" },
      { name: "validator", type: "address" },
    ],
    outputs: [{ name: "nonce", type: "uint256" }],
  },
] as const;

const MODE_SINGLE = `0x${"00".repeat(32)}` as Hex;
const MODE_BATCH = `0x01${"00".repeat(31)}` as Hex;
const STUB_SIGNATURE = `0x${"11".repeat(65)}` as Hex;

type AARuntimeCall = {
  to: string;
  data?: string;
  value?: bigint;
};

const publicClient = createPublicClient({
  chain: mantleSepolia,
  transport: http(config.mantleSepoliaRpcUrl),
});

const encodeSingleExecution = (call: AARuntimeCall) =>
  `0x${[
    call.to.toLowerCase().replace(/^0x/, ""),
    (call.value ?? 0n).toString(16).padStart(64, "0"),
    (call.data ?? "0x").replace(/^0x/, ""),
  ].join("")}` as Hex;

const encodeBatchExecution = (calls: readonly AARuntimeCall[]) =>
  encodeAbiParameters(
    [{
      type: "tuple[]",
      components: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "callData", type: "bytes" },
      ],
    }],
    [calls.map((call) => ({
      target: call.to as Address,
      value: call.value ?? 0n,
      callData: (call.data ?? "0x") as Hex,
    }))]
  );

const isAARuntimeConfigured = () =>
  Boolean(
    config.safe7579AdapterAddress &&
    config.delegateValidatorAddress &&
    config.aaBundlerUrl
  );

const buildSafe7579Account = async (signer: ManagedSigner, vaultAddress: string) => {
  if (!config.safe7579AdapterAddress || !config.delegateValidatorAddress) {
    throw new Error("Safe7579 AA runtime is not fully configured.");
  }
  if (!signer.signHash) {
    throw new Error("Managed signer cannot sign ERC-4337 user operations.");
  }

  return toSmartAccount({
    client: publicClient as any,
    entryPoint: {
      abi: entryPoint07Abi,
      address: config.aaEntryPointAddress as Address,
      version: "0.7",
    },
    async getAddress() {
      return vaultAddress as Address;
    },
    async encodeCalls(calls) {
      const normalized = calls.map((call) => ({
        to: call.to,
        data: call.data,
        value: call.value,
      }));
      const executionCalldata = normalized.length === 1
        ? encodeSingleExecution(normalized[0])
        : encodeBatchExecution(normalized);
      const mode = normalized.length === 1 ? MODE_SINGLE : MODE_BATCH;
      return encodeFunctionData({
        abi: safe7579Abi,
        functionName: "execute",
        args: [mode, executionCalldata],
      });
    },
    async decodeCalls() {
      return [];
    },
    async getFactoryArgs() {
      return { factory: undefined, factoryData: undefined };
    },
    async getNonce() {
      return publicClient.readContract({
        address: config.safe7579AdapterAddress as Address,
        abi: safe7579Abi,
        functionName: "getNonce",
        args: [
          vaultAddress as Address,
          config.delegateValidatorAddress as Address,
        ],
      });
    },
    async getStubSignature() {
      return STUB_SIGNATURE;
    },
    async signMessage() {
      throw new Error("Message signing is not supported on the Safe7579 executor account.");
    },
    async signTypedData() {
      throw new Error("Typed-data signing is not supported on the Safe7579 executor account.");
    },
    async signUserOperation(parameters) {
      const userOperationHash = getUserOperationHash({
        chainId: parameters.chainId ?? mantleSepolia.id,
        entryPointAddress: config.aaEntryPointAddress as Address,
        entryPointVersion: "0.7",
        userOperation: parameters as UserOperation<"0.7">,
      });
      return signer.signHash!(userOperationHash);
    },
  });
};

export async function sendAAVaultUserOperation(args: {
  signer: ManagedSigner;
  vaultAddress: string;
  calls: readonly AARuntimeCall[];
}) {
  if (!isAARuntimeConfigured()) {
    throw new Error("AA runtime is not configured with a Safe7579 adapter, validator and bundler URL.");
  }

  const account = await buildSafe7579Account(args.signer, args.vaultAddress);
  const bundlerClient = createBundlerClient({
    account,
    chain: mantleSepolia,
    transport: http(config.aaBundlerUrl!),
  });

  const userOpHash = await bundlerClient.sendUserOperation({
    account,
    calls: args.calls.map((call) => ({
      to: call.to as Address,
      value: call.value ?? 0n,
      data: (call.data ?? "0x") as Hex,
    })),
  });
  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

  return {
    userOpHash,
    txHash: receipt.receipt.transactionHash,
  };
}

export function canUseAARuntime(signer: ManagedSigner) {
  return isAARuntimeConfigured() && signer.getCapabilities().canSignUserOperations;
}
