import { createPublicClient, defineChain, http } from "viem";
import { createExecutorConfig, type ExecutorConfig, type ExecutorEnvBindings } from "./config.js";
import { DataApiClient } from "./dataApi.js";
import { loadExecutorEnv } from "./envLoader.js";
import {
  AddressOnlyManagedSigner,
  RemoteManagedSigner,
  TurnkeyManagedSigner,
  type ManagedSigner,
} from "./managedSigner.js";

export type ExecutorRuntime = {
  config: ExecutorConfig;
  chain: ReturnType<typeof defineChain>;
  dataApi: DataApiClient;
  publicClient: ReturnType<typeof createPublicClient>;
  managedSigner: ManagedSigner;
};

let activeRuntime: ExecutorRuntime | null = null;
let activeRuntimeFingerprint: string | null = null;

const buildManagedSigner = (config: ExecutorConfig): ManagedSigner =>
  config.managedSignerUrl
    ? new RemoteManagedSigner(config.managedSignerUrl, config.managedSignerToken)
    : (
        config.turnkeyOrganizationId &&
        config.turnkeyApiPublicKey &&
        config.turnkeyApiPrivateKey &&
        config.turnkeyWalletAccountAddress
      )
        ? new TurnkeyManagedSigner({
            apiBaseUrl: config.turnkeyApiBaseUrl,
            organizationId: config.turnkeyOrganizationId,
            apiPublicKey: config.turnkeyApiPublicKey,
            apiPrivateKey: config.turnkeyApiPrivateKey,
            walletAccountAddress: config.turnkeyWalletAccountAddress,
            walletAccountId: config.turnkeyWalletAccountId,
            rpcUrl: config.mantleSepoliaRpcUrl,
          })
        : new AddressOnlyManagedSigner(config.agentSessionSignerAddress);

const buildRuntime = (config: ExecutorConfig): ExecutorRuntime => {
  const chain = defineChain({
    id: config.chainId,
    name: config.chainName,
    nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
    rpcUrls: {
      default: { http: [config.mantleSepoliaRpcUrl] },
    },
  });

  return {
    config,
    chain,
    dataApi: new DataApiClient(config.dataApiBaseUrl.replace(/\/+$/, ""), config.internalApiToken),
    publicClient: createPublicClient({
      chain,
      transport: http(config.mantleSepoliaRpcUrl),
    }),
    managedSigner: buildManagedSigner(config),
  };
};

const isNodeRuntime = () => typeof process !== "undefined" && process.release?.name === "node";

export const initializeExecutorRuntime = (env: ExecutorEnvBindings) => {
  const config = createExecutorConfig(env);
  const fingerprint = JSON.stringify(config);
  if (activeRuntime && activeRuntimeFingerprint === fingerprint) {
    return activeRuntime;
  }

  activeRuntime = buildRuntime(config);
  activeRuntimeFingerprint = fingerprint;
  return activeRuntime;
};

export const initializeLocalExecutorRuntime = () => {
  if (!isNodeRuntime()) {
    throw new Error("Local executor runtime initialization is only available in a Node process.");
  }
  loadExecutorEnv();
  return initializeExecutorRuntime(process.env as Record<string, string | undefined>);
};

export const getExecutorRuntime = () => {
  if (activeRuntime) {
    return activeRuntime;
  }
  if (isNodeRuntime()) {
    return initializeLocalExecutorRuntime();
  }
  throw new Error("Executor runtime has not been initialized for this request.");
};
