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
  id: config.chainId,
  name: config.chainName,
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

export type BundlerEndpointStatus = {
  url: string;
  healthy: boolean;
  chainId: number | null;
  supportsConfiguredEntryPoint: boolean;
  supportedEntryPoints: string[];
  error: string | null;
};

export type AARuntimeStatus = {
  configured: boolean;
  signerCanSign: boolean;
  entryPointAddress: string;
  selectedBundlerUrl: string | null;
  endpoints: BundlerEndpointStatus[];
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
    config.aaBundlerUrls.length > 0
  );

let cachedBundlerStatus:
  | {
      expiresAt: number;
      value: AARuntimeStatus;
    }
  | null = null;

const normalizeAddress = (value: string) => value.toLowerCase();

const callBundlerRpc = async (url: string, method: string, params: unknown[] = []) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const payload = await response.json() as {
    result?: unknown;
    error?: { code?: number; message?: string };
  };

  if (payload.error) {
    throw new Error(payload.error.message || `JSON-RPC error ${payload.error.code ?? "unknown"}`);
  }

  return payload.result;
};

const probeBundlerEndpoint = async (url: string): Promise<BundlerEndpointStatus> => {
  try {
    const chainIdHex = await callBundlerRpc(url, "eth_chainId");
    const supportedEntryPointsRaw = await callBundlerRpc(url, "eth_supportedEntryPoints");
    const chainId = typeof chainIdHex === "string" ? Number.parseInt(chainIdHex, 16) : Number.NaN;
    const supportedEntryPoints = Array.isArray(supportedEntryPointsRaw)
      ? supportedEntryPointsRaw.filter((value): value is string => typeof value === "string").map(normalizeAddress)
      : [];
    const supportsConfiguredEntryPoint = supportedEntryPoints.includes(normalizeAddress(config.aaEntryPointAddress));
    const healthy = Number.isFinite(chainId) && chainId === mantleSepolia.id && supportsConfiguredEntryPoint;

    return {
      url,
      healthy,
      chainId: Number.isFinite(chainId) ? chainId : null,
      supportsConfiguredEntryPoint,
      supportedEntryPoints,
      error: healthy ? null : `Bundler does not match chain ${config.chainId} and the configured EntryPoint.`,
    };
  } catch (error) {
    return {
      url,
      healthy: false,
      chainId: null,
      supportsConfiguredEntryPoint: false,
      supportedEntryPoints: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export async function getAARuntimeStatus(signer: ManagedSigner, forceRefresh = false): Promise<AARuntimeStatus> {
  const signerCanSign = signer.getCapabilities().canSignUserOperations;
  if (!forceRefresh && cachedBundlerStatus && cachedBundlerStatus.expiresAt > Date.now()) {
    return {
      ...cachedBundlerStatus.value,
      signerCanSign,
    };
  }

  const endpoints = await Promise.all(config.aaBundlerUrls.map((url) => probeBundlerEndpoint(url)));
  const selectedBundlerUrl = endpoints.find((endpoint) => endpoint.healthy)?.url ?? null;
  const value: AARuntimeStatus = {
    configured: isAARuntimeConfigured(),
    signerCanSign,
    entryPointAddress: config.aaEntryPointAddress,
    selectedBundlerUrl,
    endpoints,
  };

  cachedBundlerStatus = {
    expiresAt: Date.now() + 60_000,
    value,
  };

  return value;
}

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
  const runtimeStatus = await getAARuntimeStatus(args.signer, true);
  if (!runtimeStatus.configured) {
    throw new Error("AA runtime is not configured with a Safe7579 adapter, validator and bundler URL.");
  }
  if (!runtimeStatus.selectedBundlerUrl) {
    throw new Error(`No healthy ERC-4337 bundler endpoint is configured for chain ${config.chainId} and the selected EntryPoint.`);
  }

  const account = await buildSafe7579Account(args.signer, args.vaultAddress);
  const healthyUrls = runtimeStatus.endpoints.filter((endpoint) => endpoint.healthy).map((endpoint) => endpoint.url);
  const orderedUrls = [
    runtimeStatus.selectedBundlerUrl,
    ...healthyUrls.filter((url) => url !== runtimeStatus.selectedBundlerUrl),
  ];
  const calls = args.calls.map((call) => ({
    to: call.to as Address,
    value: call.value ?? 0n,
    data: (call.data ?? "0x") as Hex,
  }));

  let userOpHash: Hex | null = null;
  let sendingBundlerUrl: string | null = null;
  const sendErrors: string[] = [];

  for (const bundlerUrl of orderedUrls) {
    try {
      const bundlerClient = createBundlerClient({
        account,
        chain: mantleSepolia,
        transport: http(bundlerUrl),
      });
      userOpHash = await bundlerClient.sendUserOperation({
        account,
        calls,
      });
      sendingBundlerUrl = bundlerUrl;
      break;
    } catch (error) {
      sendErrors.push(`${bundlerUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!userOpHash || !sendingBundlerUrl) {
    throw new Error(`Failed to submit the UserOperation to every healthy bundler endpoint. ${sendErrors.join(" | ")}`);
  }

  const waitUrls = [
    sendingBundlerUrl,
    ...orderedUrls.filter((url) => url !== sendingBundlerUrl),
  ];
  let lastReceiptError: string | null = null;

  for (const bundlerUrl of waitUrls) {
    try {
      const bundlerClient = createBundlerClient({
        account,
        chain: mantleSepolia,
        transport: http(bundlerUrl),
      });
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });

      return {
        userOpHash,
        txHash: receipt.receipt.transactionHash,
        bundlerUrl: sendingBundlerUrl,
      };
    } catch (error) {
      lastReceiptError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(
    `UserOperation submitted to ${sendingBundlerUrl}, but receipt lookup failed across all healthy bundlers. userOpHash=${userOpHash}. ${lastReceiptError ?? ""}`.trim()
  );
}

export function canUseAARuntime(signer: ManagedSigner) {
  return isAARuntimeConfigured() && signer.getCapabilities().canSignUserOperations;
}
