export type ExecutorEnvBindings = Record<string, string | undefined | null>;

export type ExecutorConfig = {
  envProfile: string;
  chainId: number;
  chainName: string;
  port: number;
  dataApiBaseUrl: string;
  mantleSepoliaRpcUrl: string;
  biconomyApiKey: string | null;
  biconomyMeeUrl: string | null;
  pimlicoApiKey: string | null;
  vaultProviderStrategy: string;
  onboardingProvider: string;
  managedSignerProvider: string;
  benchmarkContract: string;
  policyRegistryContract: string | null;
  executionGuardContract: string | null;
  safe4337ModuleAddress: string | null;
  safe7579AdapterAddress: string | null;
  safe7579LaunchpadAddress: string | null;
  delegateValidatorAddress: string | null;
  aaBundlerUrl: string | null;
  aaBundlerUrls: string[];
  aaEntryPointAddress: string;
  erc7484RegistryAddress: string;
  agentSmartWallet: string;
  agentSessionSignerAddress: string;
  sessionPolicyVersion: string;
  internalApiToken: string;
  managedSignerUrl: string | null;
  managedSignerToken: string | null;
  turnkeyApiBaseUrl: string;
  turnkeyOrganizationId: string | null;
  turnkeyApiPublicKey: string | null;
  turnkeyApiPrivateKey: string | null;
  turnkeyWalletAccountAddress: string | null;
  turnkeyWalletAccountId: string | null;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MANTLE_SEPOLIA_CHAIN_ID = 5003;

const required = (env: ExecutorEnvBindings, name: string, fallback?: string) => {
  const value = env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const optional = (env: ExecutorEnvBindings, name: string, fallback?: string) => env[name] ?? fallback ?? null;

const parseList = (...values: Array<string | null>) =>
  [...new Set(
    values
      .flatMap((value) => (value ?? "").split(/[,\n]/))
      .map((value) => value.trim())
      .filter(Boolean)
  )];

const optionalAddress = (env: ExecutorEnvBindings, name: string) => {
  const value = optional(env, name)?.trim() || null;
  if (!value || value.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return null;
  }
  return value;
};

const requiredAddress = (env: ExecutorEnvBindings, name: string) => {
  const value = required(env, name).trim();
  if (value.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    throw new Error(`Environment variable ${name} is still set to the zero address placeholder.`);
  }
  return value;
};

export const createExecutorConfig = (env: ExecutorEnvBindings): ExecutorConfig => {
  const configuredChainId = Number.parseInt(env.NEURALRATE_CHAIN_ID || "", 10);
  const runtimeChainId = Number.isFinite(configuredChainId) ? configuredChainId : MANTLE_SEPOLIA_CHAIN_ID;
  const runtimeChainName = env.NEURALRATE_CHAIN_NAME || "Mantle Sepolia";
  const explicitPrimary = optional(env, "NEURALRATE_4337_BUNDLER_URL");
  const explicitFallbacks = optional(env, "NEURALRATE_4337_BUNDLER_FALLBACK_URLS");
  const pimlicoApiKey = optional(env, "PIMLICO_API_KEY");
  const derivedPrimary = pimlicoApiKey
    ? `https://api.pimlico.io/v2/${runtimeChainId}/rpc?apikey=${pimlicoApiKey.trim()}`
    : null;

  return {
    envProfile: optional(env, "NEURALRATE_ENV_PROFILE", "demo") ?? "demo",
    chainId: runtimeChainId,
    chainName: runtimeChainName,
    port: Number(env.EXECUTOR_PORT || 8788),
    dataApiBaseUrl: required(env, "NEURALRATE_DATA_API_BASE_URL", "http://127.0.0.1:8787/api"),
    mantleSepoliaRpcUrl: required(env, "MANTLE_SEPOLIA_RPC_URL", "https://rpc.sepolia.mantle.xyz"),
    biconomyApiKey: optional(env, "BICONOMY_API_KEY"),
    biconomyMeeUrl: optional(env, "BICONOMY_MEE_URL"),
    pimlicoApiKey,
    vaultProviderStrategy: required(env, "NEURALRATE_VAULT_PROVIDER_STRATEGY", "safe"),
    onboardingProvider: required(env, "NEURALRATE_ONBOARDING_PROVIDER", "privy"),
    managedSignerProvider: required(env, "NEURALRATE_MANAGED_SIGNER_PROVIDER", "turnkey"),
    benchmarkContract: requiredAddress(env, "NEURALRATE_BENCHMARK_CONTRACT"),
    policyRegistryContract: optionalAddress(env, "NEURALRATE_POLICY_REGISTRY_CONTRACT"),
    executionGuardContract: optionalAddress(env, "NEURALRATE_EXECUTION_GUARD_CONTRACT"),
    safe4337ModuleAddress: optionalAddress(env, "NEURALRATE_SAFE_4337_MODULE_ADDRESS"),
    safe7579AdapterAddress: optionalAddress(env, "NEURALRATE_SAFE_7579_ADAPTER_ADDRESS"),
    safe7579LaunchpadAddress: optionalAddress(env, "NEURALRATE_SAFE_7579_LAUNCHPAD_ADDRESS"),
    delegateValidatorAddress: optionalAddress(env, "NEURALRATE_DELEGATE_VALIDATOR_ADDRESS"),
    aaBundlerUrl: explicitPrimary,
    aaBundlerUrls: parseList(explicitPrimary || derivedPrimary, explicitFallbacks),
    aaEntryPointAddress: required(env, "NEURALRATE_4337_ENTRYPOINT_ADDRESS", "0x0000000071727De22E5E9d8BAf0edAc6f37da032"),
    erc7484RegistryAddress: required(env, "NEURALRATE_ERC7484_REGISTRY_ADDRESS", "0x000000000069E2a187AEFFb852bF3cCdC95151B2"),
    agentSmartWallet: requiredAddress(env, "NEURALRATE_AGENT_SMART_WALLET"),
    agentSessionSignerAddress: requiredAddress(env, "NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS"),
    sessionPolicyVersion: required(env, "NEURALRATE_SESSION_POLICY_VERSION", "v1"),
    internalApiToken: required(env, "NEURALRATE_INTERNAL_API_TOKEN", "local-neuralrate-internal"),
    managedSignerUrl: optional(env, "NEURALRATE_MANAGED_SIGNER_URL"),
    managedSignerToken: optional(env, "NEURALRATE_MANAGED_SIGNER_TOKEN"),
    turnkeyApiBaseUrl: required(env, "TURNKEY_API_BASE_URL", "https://api.turnkey.com"),
    turnkeyOrganizationId: optional(env, "TURNKEY_ORGANIZATION_ID"),
    turnkeyApiPublicKey: optional(env, "TURNKEY_API_PUBLIC_KEY"),
    turnkeyApiPrivateKey: optional(env, "TURNKEY_API_PRIVATE_KEY"),
    turnkeyWalletAccountAddress: optional(
      env,
      "TURNKEY_WALLET_ACCOUNT_ADDRESS",
      env.NEURALRATE_AGENT_SESSION_SIGNER_ADDRESS ?? undefined
    ),
    turnkeyWalletAccountId: optional(env, "TURNKEY_WALLET_ACCOUNT_ID"),
  };
};
